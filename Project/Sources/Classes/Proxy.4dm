// Proxy
// Multi-route reverse proxy: forwards requests to upstream servers by path prefix.
// Register routes with addRoute(); handle() matches the longest prefix and forwards.

property _routes : Collection
property _utils : cs:C1710.HttpUtils

Class constructor()
	This:C1470._utils:=cs:C1710.HttpUtils.new()
	This:C1470._routes:=New collection:C1472
	
	// Register a route. $pathPrefix triggers the proxy (e.g. "/rest", "/api").
	// $keepBaseUrl True -> upstream path includes prefix; False -> prefix is stripped.
Function addRoute($pathPrefix : Text; $targetUrl : Text; $keepBaseUrl : Boolean)
	var $route : Object:=New object:C1471
	$route.pathPrefix:=This:C1470._utils.normalizePath($pathPrefix)
	$route.targetUrl:=This:C1470._utils.normalizeTargetUrl($targetUrl)
	$route.keepBaseUrl:=($keepBaseUrl#Null:C1517) ? $keepBaseUrl : True:C214
	This:C1470._routes.push($route)
	
	// If $url matches a registered prefix, forward to that upstream and return True; else return False.
Function handle($url : Text; $header : Text) : Boolean
	var $route : Object:=This:C1470._matchRoute($url)
	If ($route=Null:C1517)
		return True:C214
	End if 
	This:C1470._forwardToRoute($url; $header; $route)
	return True:C214
	
Function _matchRoute($url : Text) : Object
	var $best : Object:=Null:C1517
	var $bestLen : Integer:=0
	var $r : Object
	For each ($r; This:C1470._routes)
		var $p : Text:=$r.pathPrefix
		If (Length:C16($p)>$bestLen) && (Position:C15($p; $url)=1)
			$best:=$r
			$bestLen:=Length:C16($p)
		End if 
	End for each 
	return $best
	
Function _forwardToRoute($url : Text; $header : Text; $route : Object)
	var $parsed : Object:=This:C1470._parseRequest($route.pathPrefix)
	var $method : Text:=$parsed.method
	var $pathWithQuery : Text:=$parsed.pathWithQuery
	var $reqHeaders : Object:=$parsed.reqHeaders
	var $body : Variant:=$parsed.body
	
	var $path : Text
	var $queryString : Text
	var $sep : Integer:=Position:C15("?"; $pathWithQuery)
	If ($sep>0)
		$path:=Substring:C12($pathWithQuery; 1; $sep-1)
		$queryString:=Substring:C12($pathWithQuery; $sep+1)
	Else 
		$path:=$pathWithQuery
		$queryString:=""
	End if 
	
	var $upstreamPath : Text
	If ($route.keepBaseUrl)
		$upstreamPath:=$route.pathPrefix+This:C1470._utils.normalizePath($path)
	Else 
		$upstreamPath:=This:C1470._utils.normalizePath($path)
		If ($upstreamPath="")
			$upstreamPath:="/"
		End if 
	End if 
	
	var $upstreamUrl : Text:=$route.targetUrl+$upstreamPath
	If (Length:C16($queryString)>0)
		$upstreamUrl:=$upstreamUrl+"?"+$queryString
	End if 
	
	var $result : Object:=This:C1470._forwardRequest($method; $upstreamUrl; $body; $reqHeaders)
	This:C1470._sendResponse($result.status; $result.responseHeaders; $result.responseBody)
	
Function _parseRequest($pathPrefix : Text) : Object
	var $parsed : Object:=This:C1470._utils.parseWebConnectionHeaders()
	var $method : Text:=$parsed.method
	var $pathWithQuery : Text:=$parsed.path
	var $reqHeaders : Object:=$parsed.headers
	var $body : Variant:=""
	
	If (Length:C16($pathPrefix)>0) && (Position:C15($pathPrefix; $pathWithQuery)=1)
		$pathWithQuery:=This:C1470._utils.stripPathPrefix($pathWithQuery; $pathPrefix)
		$pathWithQuery:=This:C1470._utils.normalizePath($pathWithQuery)
	End if 
	
	If (($method="POST") || ($method="PUT") || ($method="PATCH"))
		var $blob : Blob
		WEB GET HTTP BODY:C814($blob)
		If (BLOB size:C605($blob)>0)
			$body:=BLOB to text:C555($blob; UTF8 text without length:K22:17)
		End if 
	End if 
	
	return New object:C1471("method"; $method; "pathWithQuery"; $pathWithQuery; "reqHeaders"; $reqHeaders; "body"; $body)
	
Function _forwardRequest($method : Text; $url : Text; $contents : Variant; $reqHeaders : Object) : Object
	var $responseHeaders : Object:=New object:C1471
	var $responseBody : Variant:=""
	var $status : Integer:=0
	
	ARRAY TEXT:C222($hNames; 0)
	ARRAY TEXT:C222($hValues; 0)
	var $key : Text
	For each ($key; $reqHeaders)
		If (($key="Host") || ($key="Connection") || ($key="Accept-Encoding"))
			continue
		End if 
		APPEND TO ARRAY:C911($hNames; $key)
		APPEND TO ARRAY:C911($hValues; $reqHeaders[$key])
	End for each 
	
	var $response : Text
	Try
		$status:=HTTP Request:C1158($method; $url; $contents; $response; $hNames; $hValues)
		$responseBody:=$response
		var $j : Integer
		For ($j; 1; Size of array:C274($hNames))
			If ($j<=Size of array:C274($hValues))
				$responseHeaders[$hNames{$j}]:=$hValues{$j}
			End if 
		End for 
	Catch
		$status:=502
		$responseBody:=""
		$responseHeaders["Content-Type"]:="application/json"
		$responseBody:=JSON Stringify:C1217(New object:C1471("error"; "Bad Gateway"; "message"; Last errors:C1799.last().message))
	End try
	
	If ($status=0)
		$status:=502
		$responseHeaders["Content-Type"]:="application/json"
		$responseBody:=JSON Stringify:C1217(New object:C1471("error"; "Bad Gateway"; "message"; "Upstream unreachable"))
	End if 
	
	return New object:C1471("status"; $status; "responseHeaders"; $responseHeaders; "responseBody"; $responseBody)
	
Function _sendResponse($status : Integer; $responseHeaders : Object; $responseBody : Variant)
	var $bodyText : Text
	If (Value type:C1509($responseBody)=Is text:K8:3)
		$bodyText:=$responseBody
	Else 
		$bodyText:=String:C10($responseBody)
	End if 
	This:C1470._utils.sendRawResponse($status; $responseHeaders; $bodyText)
	