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

If (Position:C15("/api"; $url)=1)
	$mind.start()
	$mind.getRouter().handle($url; $header)
	return 
End if 