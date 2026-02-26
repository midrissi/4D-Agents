// ORDAMindAgent
// Wraps OpenAIChatHelper with declarative config (instructions, model, tools)

property id : Text
property name : Text
property instructions : Text
property model : Text
property numberOfMessages : Integer
property tools : Collection

property _client : cs:C1710.OpenAI
property _helper : cs:C1710.OpenAIChatHelper

Class constructor($config : Object)
	If ($config=Null:C1517)
		return 
	End if 
	
	This:C1470.id:=$config.id || $config.name || ""
	This:C1470.name:=($config.name#Null:C1517) ? $config.name : This:C1470.id
	This:C1470.instructions:=$config.instructions || ""
	This:C1470.model:=($config.model#Null:C1517) ? $config.model : "gpt-4o-mini"
	This:C1470.numberOfMessages:=($config.numberOfMessages#Null:C1517) ? $config.numberOfMessages : 15
	
	If ($config.tools#Null:C1517)
		This:C1470.tools:=$config.tools
	Else 
		This:C1470.tools:=New collection:C1472
	End if 
	
	// Use provided client or create default
	If ($config.client#Null:C1517) && (OB Instance of:C1731($config.client; cs:C1710.OpenAI))
		This:C1470._client:=$config.client
	Else 
		This:C1470._client:=cs:C1710.OpenAI.new()
	End if 
	
	This:C1470._buildHelper()
	
Function _buildHelper()
	var $parameters : Object
	$parameters:=New object:C1471("model"; This:C1470.model)
	
	If (This:C1470.numberOfMessages>0)
		$parameters.numberOfMessages:=This:C1470.numberOfMessages
	End if 
	
	This:C1470._helper:=This:C1470._client.chat.create(This:C1470.instructions; $parameters)
	This:C1470._helper.autoHandleToolCalls:=True:C214
	
	// Register ORDAMindTools
	var $tool : cs:C1710.ORDAMindTool
	For each ($tool; This:C1470.tools)
		If (OB Instance of:C1731($tool; cs:C1710.ORDAMindTool))
			This:C1470._helper.registerTool($tool.getOpenAITool(); $tool.getHandler())
		End if 
	End for each 
	
	// Send a prompt and get response
Function prompt($message : Variant) : cs:C1710.OpenAIChatCompletionsResult
	return This:C1470._helper.prompt($message)
	
	// Stream a prompt - pass parameters with onData, onTerminate
Function stream($messages : Collection; $parameters : Object) : cs:C1710.OpenAIChatCompletionsResult
	var $streamParams : Object
	If ($parameters#Null:C1517)
		$streamParams:=New object:C1471("stream"; True:C214; "model"; This:C1470.model)
	Else 
		$streamParams:=OB Copy:C1225($parameters)
		$streamParams.stream:=True:C214
		If ($streamParams.model=Null:C1517)
			$streamParams.model:=This:C1470.model
		End if 
	End if 
	
	// Create helper via chat.create (same API as non-stream)
	var $streamHelper:=This:C1470._client.chat.create(This:C1470.instructions; cs:C1710.OpenAIChatCompletionsParameters.new($streamParams))
	$streamHelper.autoHandleToolCalls:=True:C214
	
	// Register tools
	var $tool : cs:C1710.ORDAMindTool
	For each ($tool; This:C1470.tools)
		If (OB Instance of:C1731($tool; cs:C1710.ORDAMindTool))
			$streamHelper.registerTool($tool.getOpenAITool(); $tool.getHandler())
		End if 
	End for each 
	
	// Push prior messages (all but last), then prompt with last
	If ($messages#Null:C1517) && ($messages.length>0)
		var $i : Integer
		For ($i; 1; $messages.length-1)
			var $msg:=$messages[$i]
			If (OB Instance of:C1731($msg; cs:C1710.OpenAIMessage))
				$streamHelper._pushMessage($msg)
			Else 
				$streamHelper._pushMessage(cs:C1710.OpenAIMessage.new($msg))
			End if 
		End for 
		var $lastMsg:=$messages[$messages.length]
		If (OB Instance of:C1731($lastMsg; cs:C1710.OpenAIMessage))
			return $streamHelper.prompt($lastMsg)
		Else 
			return $streamHelper.prompt($lastMsg.content)
		End if 
	End if 
	
	return Null:C1517
	
Function reset()
	This:C1470._buildHelper()
	
Function getHelper() : cs:C1710.OpenAIChatHelper
	return This:C1470._helper
	