// Scorer
// LLM-based evaluator for agent runs
// score($runInput, $runOutput) → preprocess → analyze (LLM) → generateScore → generateReason

property id : Text
property name : Text
property description : Text
property model : Text
property instructions : Text
property outputSchema : Object
property preprocess : Variant
property generateScore : Variant
property generateReason : Variant

property _client : cs:C1710.AIKit.OpenAI

Class constructor($config : Object)
	If ($config=Null:C1517)
		return 
	End if 
	
	This:C1470.id:=$config.id || $config.name || ""
	This:C1470.name:=($config.name#Null:C1517) ? $config.name : This:C1470.id
	This:C1470.description:=($config.description#Null:C1517) ? $config.description : ""
	This:C1470.model:=($config.model#Null:C1517) ? $config.model : "gpt-4o-mini"
	This:C1470.instructions:=$config.instructions || ""
	This:C1470.outputSchema:=$config.outputSchema
	This:C1470.preprocess:=$config.preprocess
	This:C1470.generateScore:=$config.generateScore
	This:C1470.generateReason:=$config.generateReason
	
	If ($config.client#Null:C1517) && (OB Instance of:C1731($config.client; cs:C1710.AIKit.OpenAI))
		This:C1470._client:=$config.client
	Else 
		This:C1470._client:=cs:C1710.AIKit.OpenAI.new()
	End if 
	
Function score($runInput : Object; $runOutput : Object) : Object
	var $preprocessed : Object
	If (This:C1470.preprocess#Null:C1517)
		Case of 
			: (OB Instance of:C1731(This:C1470.preprocess; 4D:C1709.Function))
				$preprocessed:=This:C1470.preprocess.call(This:C1470; $runInput; $runOutput)
			: (Value type:C1509(This:C1470.preprocess)=Is object:K8:27)
				If (OB Is defined:C1231(This:C1470.preprocess; "run"))
					$preprocessed:=This:C1470.preprocess.run($runInput; $runOutput)
				Else 
					$preprocessed:=New object:C1471("runInput"; $runInput; "runOutput"; $runOutput)
				End if 
			Else 
				$preprocessed:=New object:C1471("runInput"; $runInput; "runOutput"; $runOutput)
		End case 
	Else 
		$preprocessed:=New object:C1471("runInput"; $runInput; "runOutput"; $runOutput)
	End if 
	
	var $analyzeResult:=This:C1470._analyze($preprocessed)
	var $score:=This:C1470._computeScore($analyzeResult)
	var $reason:=This:C1470._computeReason($analyzeResult; $score)
	
	return New object:C1471("score"; $score; "reason"; $reason; "analyzeResult"; $analyzeResult)
	
Function _analyze($preprocessed : Object) : Object
	var $helper : cs:C1710.AIKit.OpenAIChatHelper
	var $prompt:="Evaluate the following run.\n\n"
	$prompt:=$prompt+"Preprocessed data: "+JSON Stringify:C1217($preprocessed)+"\n\n"
	$prompt:=$prompt+This:C1470.instructions
	$prompt:=$prompt+"\n\nReturn your evaluation as valid JSON."
	
	var $params : Object:=New object:C1471("model"; This:C1470.model)
	If (This:C1470.outputSchema#Null:C1517)
		$params.response_format:=New object:C1471("type"; "json_schema"; "json_schema"; This:C1470.outputSchema)
	End if 
	
	$helper:=This:C1470._client.chat.create("You are an expert evaluator. Return only valid JSON."; cs:C1710.AIKit.OpenAIChatCompletionsParameters.new($params))
	var $result:=$helper.prompt($prompt)
	
	If ($result=Null:C1517) || (Not:C34($result.success)) || ($result.choice=Null:C1517)
		return New object:C1471("error"; "LLM analysis failed")
	End if 
	
	var $content:=$result.choice.message.content
	If ($content=Null:C1517)
		return New object:C1471("error"; "Empty LLM response")
	End if 
	
	Try
		return JSON Parse:C1218($content)
	Catch
		return New object:C1471("raw"; $content; "error"; "JSON parse failed")
	End try
	
Function _computeScore($analyzeResult : Object) : Variant
	If (This:C1470.generateScore=Null:C1517)
		return 0
	End if 
	
	Case of 
		: (OB Instance of:C1731(This:C1470.generateScore; 4D:C1709.Function))
			return This:C1470.generateScore.call(This:C1470; $analyzeResult)
		: (Value type:C1509(This:C1470.generateScore)=Is object:K8:27)
			If (OB Is defined:C1231(This:C1470.generateScore; "run"))
				return This:C1470.generateScore.run($analyzeResult)
			Else 
				return 0
			End if 
		Else 
			return 0
	End case 
	
Function _computeReason($analyzeResult : Object; $score : Variant) : Text
	If (This:C1470.generateReason=Null:C1517)
		return "Score: "+String:C10($score)
	End if 
	
	var $reason : Text
	Case of 
		: (OB Instance of:C1731(This:C1470.generateReason; 4D:C1709.Function))
			$reason:=This:C1470.generateReason.call(This:C1470; $analyzeResult; $score)
		: (Value type:C1509(This:C1470.generateReason)=Is object:K8:27)
			If (OB Is defined:C1231(This:C1470.generateReason; "run"))
				$reason:=This:C1470.generateReason.run($analyzeResult; $score)
			Else 
				$reason:="Score: "+String:C10($score)
			End if 
		Else 
			$reason:="Score: "+String:C10($score)
	End case 
	
	If (Value type:C1509($reason)#Is text:K8:3)
		$reason:=String:C10($reason)
	End if 
	return $reason
	