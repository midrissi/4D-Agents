#DECLARE($url : Text; $header : Text; $BrowserIP : Text; $ServerIP : Text; $user : Text; $password : Text)

var $mind : cs:C1710.App
$mind:=cs:C1710.App.new(New object:C1471(\
"agents"; New object:C1471(\
"assistant"; cs:C1710.Agent.new(New object:C1471(\
"id"; "assistant"; \
"name"; "Assistant"; \
"instructions"; "You are a helpful assistant."; \
"model"; "gpt-4o-mini"\
))\
); \
"workflows"; New object:C1471; \
"tools"; New object:C1471; \
"storage"; Null:C1517; \
"logger"; cs:C1710.Logger.new(New object:C1471("name"; "ORDAMind"; "level"; "info"))\
))

var $prefix : Text:="/api"

// Optional reverse proxy: addRoute(pathPrefix, targetUrl, keepBaseUrl). handle() returns True if a route matched.
var $proxy : cs:C1710.Proxy:=cs:C1710.Proxy.new()
$proxy.addRoute("/rest"; "https://httpbin.org"; False:C214)
$proxy.addRoute("/proxy"; "https://httpbin.org"; False:C214)
If ($proxy.handle($url; $header))
	return 
End if 

If (Position:C15($prefix; $url)=1)
	$mind.start()
	$mind.getRouter($prefix).handle($url; $header)
	return 
End if 