// ORDAMindRequest
// Request wrapper - parses from WEB GET HTTP HEADER, WEB GET HTTP BODY

property method : Text
property url : Text
property path : Text
property params : Object
property query : Object
property body : Object
property headers : Object

Class constructor($url : Text)
	This.url:=$url
	This.path:=$url
	This.params:=New object
	This.query:=New object
	This.body:=New object
	This.headers:=New object
	This._parse()

Function _parse()
	ARRAY TEXT($fieldArray; 0)
	ARRAY TEXT($valueArray; 0)
	WEB GET HTTP HEADER($fieldArray; $valueArray)
	
	var $i : Integer
	For ($i; 1; Size of array($fieldArray))
		var $name:=$fieldArray{$i}
		var $value:=$valueArray{$i}
		Case of
			: ($name="X-METHOD")
				This.method:=$value
			: ($name="X-URL")
				This.path:=$value
				This.url:=$value
			Else
				This.headers[$name]:=$value
		End case
	End for
	
	If (This.method="")
		This.method:="GET"
	End if
	
	// Parse query string from path (path may be /api/agents?foo=bar)
	var $parts:=Split string(This.path; "?")
	If ($parts.length>=2)
		This.path:=$parts[1]
		This._parseQuery($parts[2])
	End if
	
	// Parse body for POST/PUT
	If ((This.method="POST") || (This.method="PUT") || (This.method="PATCH"))
		var $bodyText:=BLOB to text(WEB GET HTTP BODY; UTF8 text without length)
		If (Length($bodyText)>0)
			Try
				This.body:=JSON Parse($bodyText)
			Catch
				This.body:=New object("raw"; $bodyText)
			End try
		End if
	End if

Function _parseQuery($queryString : Text)
	If ($queryString="")
		return
	End if
	
	var $pairs:=Split string($queryString; "&")
	var $pair : Text
	For each ($pair; $pairs)
		var $kv:=Split string($pair; "=")
		If ($kv.length>=2)
			This.query[$kv[1]]:=$kv[2]
		End if
	End for each

Function param($name : Text; $defaultValue : Text) : Text
	If (OB Is defined(This.params; $name))
		return This.params[$name]
	End if
	If (OB Is defined(This.query; $name))
		return This.query[$name]
	End if
	return $defaultValue
