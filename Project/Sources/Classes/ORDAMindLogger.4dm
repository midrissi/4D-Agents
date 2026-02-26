// ORDAMindLogger
// Wraps 4D LOG EVENT or file-based logging
// Levels: debug, info, warn, error

property name : Text
property level : Text
property _levelOrder : Integer

Class constructor($config : Object)
	If ($config=Null)
		return
	End if
	
	This.name:=($config.name#Null) ? $config.name : "ORDAMind"
	This.level:=($config.level#Null) ? $config.level : "info"
	This._levelOrder:=This._levelToOrder(This.level)

Function _levelToOrder($level : Text) : Integer
	Case of
		: ($level="debug")
			return 0
		: ($level="info")
			return 1
		: ($level="warn")
			return 2
		: ($level="error")
			return 3
		Else
			return 1
	End case

Function _shouldLog($level : Text) : Boolean
	return This._levelToOrder($level)>=This._levelOrder

Function log($level : Text; $message : Text; $context : Object)
	If (Not(This._shouldLog($level)))
		return
	End if
	
	var $prefix:="["+This.name+"] ["+$level+"] "
	var $fullMessage:=$prefix+$message
	
	If ($context#Null)
		$fullMessage:=$fullMessage+" "+JSON Stringify($context)
	End if
	
	// Use 4D LOG EVENT
	LOG EVENT(1; $fullMessage)

Function debug($message : Text; $context : Object)
	This.log("debug"; $message; $context)

Function info($message : Text; $context : Object)
	This.log("info"; $message; $context)

Function warn($message : Text; $context : Object)
	This.log("warn"; $message; $context)

Function error($message : Text; $context : Object)
	This.log("error"; $message; $context)
