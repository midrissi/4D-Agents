// Request
// Request wrapper - parses from WEB GET HTTP HEADER, WEB GET HTTP BODY

property method : Text
property url : Text
property path : Text
property params : Object
property query : Object
property body : Object
property headers : Object

property _prefix : Text

Class constructor($url : Text; $prefix : Text)
	This:C1470.url:=$url
	This:C1470.path:=$url
	This:C1470._prefix:=($prefix#Null) ? $prefix : ""
	This:C1470.params:=New object:C1471
	This:C1470.query:=New object:C1471
	This:C1470.body:=New object:C1471
	This:C1470.headers:=New object:C1471
	This:C1470._parse()
	
Function _parse()
	var $utils : cs:C1710.HttpUtils:=cs:C1710.HttpUtils.new()
	var $parsed : Object:=$utils.parseWebConnectionHeaders()
	This:C1470.method:=$parsed.method
	This:C1470.path:=$parsed.path
	This:C1470.url:=$parsed.path
	This:C1470.headers:=$parsed.headers
	
	// Strip router prefix so path/url are always without prefix (e.g. for route matching)
	If (Length:C16(This:C1470._prefix)>0) && (Position:C15(This:C1470._prefix; This:C1470.path)=1)
		This:C1470.path:=$utils.stripPathPrefix(This:C1470.path; This:C1470._prefix)
		This:C1470.url:=This:C1470.path
		If (Length:C16(This:C1470.path)=0)
			This:C1470.path:="/"
			This:C1470.url:="/"
		Else 
			This:C1470.path:=$utils.normalizePath(This:C1470.path)
			This:C1470.url:=This:C1470.path
		End if 
	End if 
	
	// Parse query string from path (path may be /agents?foo=bar)
	var $parts:=Split string:C1554(This:C1470.path; "?")
	If ($parts.length>=2)
		This:C1470.path:=$parts[1]
		This:C1470._parseQuery($parts[2])
	End if 
	
	// Parse body for POST/PUT
	If ((This:C1470.method="POST") || (This:C1470.method="PUT") || (This:C1470.method="PATCH"))
		var $blob : Blob
		WEB GET HTTP BODY:C814($blob)
		var $bodyText:=BLOB to text:C555($blob; UTF8 text without length:K22:17)
		If (Length:C16($bodyText)>0)
			Try
				This:C1470.body:=JSON Parse:C1218($bodyText)
			Catch
				This:C1470.body:=New object:C1471("raw"; $bodyText)
			End try
		End if 
	End if 
	
Function _parseQuery($queryString : Text)
	If ($queryString="")
		return 
	End if 
	
	var $pairs:=Split string:C1554($queryString; "&")
	var $pair : Text
	For each ($pair; $pairs)
		var $kv:=Split string:C1554($pair; "=")
		If ($kv.length>=2)
			This:C1470.query[$kv[1]]:=$kv[2]
		End if 
	End for each 
	
Function param($name : Text; $defaultValue : Text) : Text
	If (OB Is defined:C1231(This:C1470.params; $name))
		return This:C1470.params[$name]
	End if 
	If (OB Is defined:C1231(This:C1470.query; $name))
		return This:C1470.query[$name]
	End if 
	return $defaultValue
	