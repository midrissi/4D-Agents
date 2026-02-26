// ORDAMindTool
// Wraps cs.OpenAITool with an executable handler for agent tool calls

property id : Text
property name : Text
property description : Text
property parameters : Object
property handler : Variant

property _openAITool : cs.OpenAITool

Class constructor($config : Object)
	If ($config=Null)
		return
	End if
	
	This.id:=$config.id || $config.name || ""
	This.name:=($config.name#Null) ? $config.name : This.id
	This.description:=$config.description || ""
	This.parameters:=$config.parameters
	If ($config.handler#Null)
		This.handler:=$config.handler
	End if
	
	This._buildOpenAITool()

Function _buildOpenAITool()
	var $toolConfig : Object
	$toolConfig:=New object
	$toolConfig.type:="function"
	$toolConfig.function:=New object
	$toolConfig.function.name:=This.name
	$toolConfig.function.description:=This.description
	If (This.parameters#Null)
		$toolConfig.function.parameters:=This.parameters
	Else 
		$toolConfig.function.parameters:=New object("type"; "object"; "properties"; New object(); "required"; New collection())
	End if
	$toolConfig.strict:=True
	
	This._openAITool:=cs.OpenAITool.new($toolConfig)

// Returns the OpenAITool for use with OpenAIChatHelper
Function getOpenAITool() : cs.OpenAITool
	return This._openAITool

// Returns a handler suitable for registerTool - calls execute() with parsed input
// Uses $self to bind the tool instance (handler is called with OpenAIChatHelper as This)
Function getHandler() : Variant
	var $self:=This
	return Formula($self.execute($1))

// Execute the tool with parsed input - calls user's handler
// $input : Object - parsed JSON from tool call (e.g. {"location": "Paris"})
// Returns: Text, Object, or Collection - will be stringified for tool response
Function execute($input : Object) : Variant
	If (This.handler=Null)
		return "Error: No handler defined for tool '"+This.name+"'"
	End if
	
	Try
		var $result : Variant
		Case of
			: (OB Instance of(This.handler; 4D.Function))
				$result:=This.handler.call(This; $input)
			: (Value type(This.handler)=Is object)
				If (OB Is defined(This.handler; This.name))
					$result:=This.handler[This.name]($input)
				Else
					return "Error: Handler object has no method '"+This.name+"'"
				End if
			Else
				return "Error: Invalid handler type for tool '"+This.name+"'"
		End case
		
		Return $result
	Catch
		return "Error executing tool '"+This.name+"': "+Last errors.last().message
	End try
