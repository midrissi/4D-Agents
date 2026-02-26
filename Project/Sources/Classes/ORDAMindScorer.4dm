// ORDAMindScorer
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

property _client : cs.OpenAI

Class constructor($config : Object)
	If ($config=Null)
		return
	End if
	
	This.id:=$config.id || $config.name || ""
	This.name:=($config.name#Null) ? $config.name : This.id
	This.description:=($config.description#Null) ? $config.description : ""
	This.model:=($config.model#Null) ? $config.model : "gpt-4o-mini"
	This.instructions:=$config.instructions || ""
	This.outputSchema:=$config.outputSchema
	This.preprocess:=$config.preprocess
	This.generateScore:=$config.generateScore
	This.generateReason:=$config.generateReason
	
	If ($config.client#Null) && (OB Instance of($config.client; cs.OpenAI))
		This._client:=$config.client
	Else
		This._client:=cs.OpenAI.new()
	End if

Function score($runInput : Object; $runOutput : Object) : Object
	var $preprocessed : Object
	If (This.preprocess#Null)
		Case of
			: (OB Instance of(This.preprocess; 4D.Function))
				$preprocessed:=This.preprocess.call(This; $runInput; $runOutput)
			: (Value type(This.preprocess)=Is object)
				If (OB Is defined(This.preprocess; "run"))
					$preprocessed:=This.preprocess.run($runInput; $runOutput)
				Else
					$preprocessed:=New object("runInput"; $runInput; "runOutput"; $runOutput)
				End if
			Else
				$preprocessed:=New object("runInput"; $runInput; "runOutput"; $runOutput)
		End case
	Else
		$preprocessed:=New object("runInput"; $runInput; "runOutput"; $runOutput)
	End if
	
	var $analyzeResult:=This._analyze($preprocessed)
	var $score:=This._computeScore($analyzeResult)
	var $reason:=This._computeReason($analyzeResult; $score)
	
	return New object("score"; $score; "reason"; $reason; "analyzeResult"; $analyzeResult)

Function _analyze($preprocessed : Object) : Object
	var $prompt:="Evaluate the following run.\n\n"
	$prompt:=$prompt+"Preprocessed data: "+JSON Stringify($preprocessed)+"\n\n"
	$prompt:=$prompt+This.instructions
	$prompt:=$prompt+"\n\nReturn your evaluation as valid JSON."
	
	var $params : Object:=New object("model"; This.model)
	If (This.outputSchema#Null)
		$params.response_format:=New object("type"; "json_schema"; "json_schema"; This.outputSchema)
	End if
	
	var $helper:=This._client.chat.create("You are an expert evaluator. Return only valid JSON."; cs.OpenAIChatCompletionsParameters.new($params))
	var $result:=$helper.prompt($prompt)
	
	If ($result=Null) || (Not($result.success)) || ($result.choice=Null)
		return New object("error"; "LLM analysis failed")
	End if
	
	var $content:=$result.choice.message.content
	If ($content=Null)
		return New object("error"; "Empty LLM response")
	End if
	
	Try
		return JSON Parse($content)
	Catch
		return New object("raw"; $content; "error"; "JSON parse failed")
	End try

Function _computeScore($analyzeResult : Object) : Variant
	If (This.generateScore=Null)
		return 0
	End if
	
	Case of
		: (OB Instance of(This.generateScore; 4D.Function))
			return This.generateScore.call(This; $analyzeResult)
		: (Value type(This.generateScore)=Is object)
			If (OB Is defined(This.generateScore; "run"))
				return This.generateScore.run($analyzeResult)
			Else
				return 0
			End if
		Else
			return 0
	End case

Function _computeReason($analyzeResult : Object; $score : Variant) : Text
	If (This.generateReason=Null)
		return "Score: "+String($score)
	End if
	
	var $reason : Text
	Case of
		: (OB Instance of(This.generateReason; 4D.Function))
			$reason:=This.generateReason.call(This; $analyzeResult; $score)
		: (Value type(This.generateReason)=Is object)
			If (OB Is defined(This.generateReason; "run"))
				$reason:=This.generateReason.run($analyzeResult; $score)
			Else
				$reason:="Score: "+String($score)
			End if
		Else
			$reason:="Score: "+String($score)
	End case
	
	If (Value type($reason)#Is text)
		$reason:=String($reason)
	End if
	return $reason
