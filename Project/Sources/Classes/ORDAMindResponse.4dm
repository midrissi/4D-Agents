// ORDAMindResponse
// Response builder - sends via WEB SEND RAW DATA

property statusCode : Integer
property _headers : Object
property _body : Text

Class constructor()
	This:C1470.statusCode:=200
	This:C1470._headers:=New object:C1471("Content-Type"; "application/json")
	
Function status($code : Integer) : cs:C1710.ORDAMindResponse
	This:C1470.statusCode:=$code
	return This:C1470
	
Function setHeader($name : Text; $value : Text) : cs:C1710.ORDAMindResponse
	This:C1470._headers[$name]:=$value
	return This:C1470
	
Function json($object : Object) : cs:C1710.ORDAMindResponse
	This:C1470.setHeader("Content-Type"; "application/json")
	This:C1470._body:=JSON Stringify:C1217($object)
	This:C1470._send()
	return This:C1470
	
Function send($body : Text) : cs:C1710.ORDAMindResponse
	This:C1470._body:=$body
	This:C1470._send()
	return This:C1470
	
Function _send()
	var $statusText:="OK"
	Case of 
		: (This:C1470.statusCode=200)
			$statusText:="OK"
		: (This:C1470.statusCode=201)
			$statusText:="Created"
		: (This:C1470.statusCode=204)
			$statusText:="No Content"
		: (This:C1470.statusCode=400)
			$statusText:="Bad Request"
		: (This:C1470.statusCode=404)
			$statusText:="Not Found"
		: (This:C1470.statusCode=500)
			$statusText:="Internal Server Error"
		Else 
			$statusText:=""
	End case 
	
	var $response:="HTTP/1.1 "+String:C10(This:C1470.statusCode)+" "+$statusText+Char:C90(13)+Char:C90(10)
	var $key : Text
	For each ($key; This:C1470._headers)
		$response:=$response+$key+": "+This:C1470._headers[$key]+Char:C90(13)+Char:C90(10)
	End for each 
	$response:=$response+Char:C90(13)+Char:C90(10)
	$response:=$response+This:C1470._body
	
	var $blob : Blob
	TEXT TO BLOB:C554($response; $blob; UTF8 text without length:K22:17)
	
	WEB SEND RAW DATA:C815($blob)
	