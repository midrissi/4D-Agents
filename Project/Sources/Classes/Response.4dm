// Response
// Response builder - sends via WEB SEND RAW DATA

property statusCode : Integer
property _headers : Object
property _body : Text

Class constructor()
	This:C1470.statusCode:=200
	This:C1470._headers:=New object:C1471("Content-Type"; "application/json")
	
Function status($code : Integer) : cs:C1710.Response
	This:C1470.statusCode:=$code
	return This:C1470
	
Function setHeader($name : Text; $value : Text) : cs:C1710.Response
	This:C1470._headers[$name]:=$value
	return This:C1470
	
Function json($object : Object) : cs:C1710.Response
	This:C1470.setHeader("Content-Type"; "application/json")
	This:C1470._body:=JSON Stringify:C1217($object)
	This:C1470._send()
	return This:C1470
	
Function send($body : Text) : cs:C1710.Response
	This:C1470._body:=$body
	This:C1470._send()
	return This:C1470
	
Function _send()
	var $utils : cs:C1710.HttpUtils:=cs:C1710.HttpUtils.new()
	$utils.sendRawResponse(This:C1470.statusCode; This:C1470._headers; This:C1470._body)
	