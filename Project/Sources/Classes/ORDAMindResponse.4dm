// ORDAMindResponse
// Response builder - sends via WEB SEND RAW DATA

property statusCode : Integer
property _headers : Object
property _body : Text

Class constructor()
	This.statusCode:=200
	This._headers:=New object("Content-Type"; "application/json")

Function status($code : Integer) : cs.ORDAMindResponse
	This.statusCode:=$code
	return This

Function setHeader($name : Text; $value : Text) : cs.ORDAMindResponse
	This._headers[$name]:=$value
	return This

Function json($object : Object) : cs.ORDAMindResponse
	This.setHeader("Content-Type"; "application/json")
	This._body:=JSON Stringify($object)
	This._send()
	return This

Function send($body : Text) : cs.ORDAMindResponse
	This._body:=$body
	This._send()
	return This

Function _send()
	var $statusText:="OK"
	Case of
		: (This.statusCode=200)
			$statusText:="OK"
		: (This.statusCode=201)
			$statusText:="Created"
		: (This.statusCode=204)
			$statusText:="No Content"
		: (This.statusCode=400)
			$statusText:="Bad Request"
		: (This.statusCode=404)
			$statusText:="Not Found"
		: (This.statusCode=500)
			$statusText:="Internal Server Error"
		Else
			$statusText:=""
	End case
	
	var $response:="HTTP/1.1 "+String(This.statusCode)+" "+$statusText+Char(13)+Char(10)
	var $key : Text
	For each ($key; This._headers)
		$response:=$response+$key+": "+This._headers[$key]+Char(13)+Char(10)
	End for each
	$response:=$response+Char(13)+Char(10)
	$response:=$response+This._body
	
	WEB SEND RAW DATA(Text to blob($response; UTF8 text without length))
