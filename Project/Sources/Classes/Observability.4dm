// Observability
// Trace/span model for debugging and basic dashboards
// startTrace, startSpan, endSpan, recordEvent

property _storage : cs.StorageBase
property _currentTrace : Object
property _currentSpan : Object
property _spans : Collection

Class constructor($config : Object)
	If ($config=Null)
		return 
	End if 
	
	This._storage:=$config.storage
	This._spans:=New collection
	
Function startTrace($name : Text; $attributes : Object) : Text
	var $traceId:="trace-"+String(Current date; ISO date GMT)
	$traceId:=Replace string($traceId; " "; "-")
	$traceId:=Replace string($traceId; ":"; "")
	$traceId:=Replace string($traceId; "."; "")
	
	This._currentTrace:=New object("id"; $traceId; "name"; $name; "startTime"; Current date; "attributes"; $attributes; "spans"; New collection)
	return $traceId
	
Function endTrace($traceId : Text) : Object
	If (This._currentTrace=Null) || (This._currentTrace.id#$traceId)
		return Null
	End if 
	
	This._currentTrace.endTime:=Current date
	If (This._storage#Null)
		This._storage.saveTrace(This._currentTrace)
	End if 
	
	var $trace:=This._currentTrace
	This._currentTrace:=Null
	This._currentSpan:=Null
	return $trace
	
Function startSpan($name : Text; $attributes : Object) : Text
	var $spanId:="span-"+String(Current date; ISO date GMT)
	$spanId:=Replace string($spanId; " "; "-")
	$spanId:=Replace string($spanId; ":"; "")
	$spanId:=Replace string($spanId; "."; "")
	
	var $span:=New object("id"; $spanId; "name"; $name; "startTime"; Current date; "attributes"; $attributes)
	
	If (This._currentTrace#Null)
		This._currentTrace.spans.push($span)
	End if 
	
	This._currentSpan:=$span
	return $spanId
	
Function endSpan($spanId : Text) : Object
	If (This._currentSpan=Null) || (This._currentSpan.id#$spanId)
		return Null
	End if 
	
	This._currentSpan.endTime:=Current date
	var $span:=This._currentSpan
	This._currentSpan:=Null
	return $span
	
Function recordEvent($name : Text; $attributes : Object)
	If (This._currentSpan#Null)
		If (This._currentSpan.events=Null)
			This._currentSpan.events:=New collection
		End if 
		This._currentSpan.events.push(New object("name"; $name; "time"; Current date; "attributes"; $attributes))
	End if 
	