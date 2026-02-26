// ORDAMindAgent
// Wraps OpenAIChatHelper with declarative config (instructions, model, tools)

property id : Text
property name : Text
property instructions : Text
property model : Text
property numberOfMessages : Integer
property tools : Collection

property _client : cs.AIKit.OpenAI
property _helper : cs.AIKit.OpenAIChatHelper

Class constructor($config : Object)
	If ($config=Null)
		return 
	End if 
	
	This.id:=$config.id || $config.name || ""
	This.name:=($config.name#Null) ? $config.name : This.id
	This.instructions:=$config.instructions || ""
	This.model:=($config.model#Null) ? $config.model : "gpt-4o-mini"
	This.numberOfMessages:=($config.numberOfMessages#Null) ? $config.numberOfMessages : 15
	
	If ($config.tools#Null)
		This.tools:=$config.tools
	Else 
		This.tools:=New collection
	End if 
	
	// Use provided client or create default
	If ($config.client#Null) && (OB Instance of($config.client; cs.AIKit.OpenAI))
		This._client:=$config.client
	Else 
		This._client:=cs.AIKit.OpenAI.new()
	End if 
	
	This._buildHelper()
	
Function _buildHelper()
	var $parameters : Object
	$parameters:=New object("model"; This.model)
	
	If (This.numberOfMessages>0)
		$parameters.numberOfMessages:=This.numberOfMessages
	End if 
	
	This._helper:=This._client.chat.create(This.instructions; $parameters)
	This._helper.autoHandleToolCalls:=True
	
	// Register ORDAMindTools
	var $tool : cs.ORDAMindTool
	For each ($tool; This.tools)
		If (OB Instance of($tool; cs.ORDAMindTool))
			This._helper.registerTool($tool.getOpenAITool(); $tool.getHandler())
		End if 
	End for each 
	
	// Send a prompt and get response
Function prompt($message : Variant) : cs.AIKit.OpenAIChatCompletionsResult
	return This._helper.prompt($message)
	
	// Stream a prompt - pass parameters with onData, onTerminate
Function stream($messages : Collection; $parameters : Object) : cs.AIKit.OpenAIChatCompletionsResult
	var $streamParams : Object
	If ($parameters#Null)
		$streamParams:=New object("stream"; True; "model"; This.model)
	Else 
		$streamParams:=OB Copy($parameters)
		$streamParams.stream:=True
		If ($streamParams.model=Null)
			$streamParams.model:=This.model
		End if 
	End if 
	
	// Create helper via chat.create (same API as non-stream)
	var $streamHelper:=This._client.chat.create(This.instructions; cs.AIKit.OpenAIChatCompletionsParameters.new($streamParams))
	$streamHelper.autoHandleToolCalls:=True
	
	// Register tools
	var $tool : cs.ORDAMindTool
	For each ($tool; This.tools)
		If (OB Instance of($tool; cs.ORDAMindTool))
			$streamHelper.registerTool($tool.getOpenAITool(); $tool.getHandler())
		End if 
	End for each 
	
	// Push prior messages (all but last), then prompt with last
	If ($messages#Null) && ($messages.length>0)
		var $i : Integer
		For ($i; 1; $messages.length-1)
			var $msg:=$messages[$i]
			If (OB Instance of($msg; cs.AIKit.OpenAIMessage))
				$streamHelper._pushMessage($msg)
			Else 
				$streamHelper._pushMessage(cs.AIKit.OpenAIMessage.new($msg))
			End if 
		End for 
		var $lastMsg:=$messages[$messages.length]
		If (OB Instance of($lastMsg; cs.AIKit.OpenAIMessage))
			return $streamHelper.prompt($lastMsg)
		Else 
			return $streamHelper.prompt($lastMsg.content)
		End if 
	End if 
	
	return Null
	
Function reset()
	This._buildHelper()
	
Function getHelper() : cs.AIKit.OpenAIChatHelper
	return This._helper
	