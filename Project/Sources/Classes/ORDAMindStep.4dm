// ORDAMindStep
// Workflow step with id, description, schemas, and execute Formula

property id : Text
property description : Text
property inputSchema : Object
property outputSchema : Object
property execute : Variant

Class constructor($config : Object)
	If ($config=Null:C1517)
		return 
	End if 
	
	This:C1470.id:=$config.id || $config.name || ""
	This:C1470.description:=($config.description#Null:C1517) ? $config.description : ""
	This:C1470.inputSchema:=$config.inputSchema
	This:C1470.outputSchema:=$config.outputSchema
	This:C1470.execute:=$config.execute
	
Function run($input : Object) : Variant
	If (This:C1470.execute=Null:C1517)
		return $input
	End if 
	
	Try
		Case of 
			: (OB Instance of:C1731(This:C1470.execute; 4D:C1709.Function))
				return This:C1470.execute.call(This:C1470; $input)
			: (Value type:C1509(This:C1470.execute)=Is object:K8:27)
				Case of 
					: (OB Is defined:C1231(This:C1470.execute; "run"))
						return This:C1470.execute.run($input)
					: (OB Is defined:C1231(This:C1470.execute; "execute"))
						return This:C1470.execute.execute($input)
					Else 
						return $input
				End case 
			Else 
				return $input
		End case 
	Catch
		// Re-raise with context
		var $err:=Last errors:C1799.last()
		throw:C1805(1; "ORDAMindStep '"+This:C1470.id+"' failed: "+$err.message)
	End try
	