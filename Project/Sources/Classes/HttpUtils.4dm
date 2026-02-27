// HttpUtils
// Shared HTTP helpers: status text, raw response sending, path/URL normalization, header parsing.

// Returns standard HTTP status text for a status code.
Function statusCodeToText($status : Integer) : Text
	Case of 
		: ($status=200)
			return "OK"
		: ($status=201)
			return "Created"
		: ($status=204)
			return "No Content"
		: ($status=400)
			return "Bad Request"
		: ($status=404)
			return "Not Found"
		: ($status=500)
			return "Internal Server Error"
		: ($status=502)
			return "Bad Gateway"
		Else 
			return ""
	End case 

// Builds HTTP/1.1 response and sends it via WEB SEND RAW DATA.
Function sendRawResponse($statusCode : Integer; $headers : Object; $body : Text)
	var $statusText : Text:=This:C1470.statusCodeToText($statusCode)
	var $response:="HTTP/1.1 "+String:C10($statusCode)+" "+$statusText+Char:C90(13)+Char:C90(10)
	var $key : Text
	For each ($key; $headers)
		$response:=$response+$key+": "+$headers[$key]+Char:C90(13)+Char:C90(10)
	End for each 
	$response:=$response+Char:C90(13)+Char:C90(10)
	$response:=$response+$body
	var $blob : Blob
	TEXT TO BLOB:C554($response; $blob; UTF8 text without length:K22:17)
	WEB SEND RAW DATA:C815($blob)

// Ensures path has a leading slash (or returns "" if empty).
Function normalizePath($p : Text) : Text
	If (Length:C16($p)=0)
		return ""
	End if 
	If (Position:C15("/"; $p)#1)
		return "/"+$p
	End if 
	return $p

// Removes trailing slash from URL (e.g. base URL for concatenation).
Function normalizeTargetUrl($url : Text) : Text
	var $u:=$url
	If (Length:C16($u)>0) && (Substring:C12($u; Length:C16($u))="/")
		$u:=Substring:C12($u; 1; Length:C16($u)-1)
	End if 
	return $u

// Strips prefix from path. E.g. stripPathPrefix("/proxy/foo"; "/proxy") -> "/foo".
Function stripPathPrefix($path : Text; $prefix : Text) : Text
	If (Length:C16($prefix)=0)
		return $path
	End if 
	If (Position:C15($prefix; $path)=1)
		var $rest:=Substring:C12($path; Length:C16($prefix)+1)
		If (Length:C16($rest)=0) || (Position:C15("/"; $rest)=1)
			return $rest
		End if 
		return "/"+$rest
	End if 
	return $path

// Reads WEB GET HTTP HEADER and returns object with method (default "GET"), path (from X-URL, default "/"), headers (object).
Function parseWebConnectionHeaders() : Object
	ARRAY TEXT:C222($fieldArray; 0)
	ARRAY TEXT:C222($valueArray; 0)
	WEB GET HTTP HEADER:C697($fieldArray; $valueArray)
	var $method : Text:="GET"
	var $path : Text:="/"
	var $headers : Object:=New object:C1471
	var $i : Integer
	For ($i; 1; Size of array:C274($fieldArray))
		var $name:=$fieldArray{$i}
		var $value:=$valueArray{$i}
		Case of 
			: ($name="X-METHOD")
				$method:=$value
			: ($name="X-URL")
				$path:=$value
			Else 
				$headers[$name]:=$value
		End case 
	End for 
	If ($method="")
		$method:="GET"
	End if 
	return New object:C1471("method"; $method; "path"; $path; "headers"; $headers)
