// ORDAMindStep
// Workflow step with id, description, schemas, and execute Formula

property id : Text
property description : Text
property inputSchema : Object
property outputSchema : Object
property execute : Variant

Class constructor($config : Object)
	If ($config=Null)
		return
	End if
	
	This.id:=$config.id || $config.name || ""
	This.description:=($config.description#Null) ? $config.description : ""
	This.inputSchema:=$config.inputSchema
	This.outputSchema:=$config.outputSchema
	This.execute:=$config.execute

Function run($input : Object) : Variant
	If (This.execute=Null)
		return $input
	End if
	
	Try
		Case of
			: (OB Instance of(This.execute; 4D.Function))
				return This.execute.call(This; $input)
			: (Value type(This.execute)=Is object)
				If (OB Is defined(This.execute; "run"))
					return This.execute.run($input)
				Else if (OB Is defined(This.execute; "execute"))
					return This.execute.execute($input)
				Else
					return $input
				End if
			Else
				return $input
		End case
	Catch
		// Re-raise with context
		var $err:=Last errors.last()
		throw(1; "ORDAMindStep '"+This.id+"' failed: "+$err.message)
	End try
