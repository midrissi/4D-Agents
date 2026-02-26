// Router
// Express-like router for On Web Connection
// Parses request via WEB GET HTTP HEADER, WEB GET HTTP BODY; matches routes; sends via WEB SEND RAW DATA

property _mind : cs:C1710.App
property _routes : Collection

Class constructor($mind : cs:C1710.App)
	This:C1470._mind:=$mind
	This:C1470._routes:=New collection:C1472
	
Function setupRoutes()
	// Agents
	This:C1470._addRoute("GET"; "/api/agents"; Formula:C1597(This:C1470._listAgents($1; $2)))
	This:C1470._addRoute("GET"; "/api/agents/:agentId"; Formula:C1597(This:C1470._getAgent($1; $2)))
	This:C1470._addRoute("POST"; "/api/agents/:agentId/generate"; Formula:C1597(This:C1470._agentGenerate($1; $2)))
	This:C1470._addRoute("POST"; "/api/agents/:agentId/stream"; Formula:C1597(This:C1470._agentStream($1; $2)))
	This:C1470._addRoute("GET"; "/api/agents/:agentId/tools"; Formula:C1597(This:C1470._listAgentTools($1; $2)))
	This:C1470._addRoute("POST"; "/api/agents/:agentId/tools/:toolId/execute"; Formula:C1597(This:C1470._executeAgentTool($1; $2)))
	// Workflows
	This:C1470._addRoute("GET"; "/api/workflows"; Formula:C1597(This:C1470._listWorkflows($1; $2)))
	This:C1470._addRoute("GET"; "/api/workflows/:workflowId"; Formula:C1597(This:C1470._getWorkflow($1; $2)))
	This:C1470._addRoute("POST"; "/api/workflows/:workflowId/create-run"; Formula:C1597(This:C1470._workflowCreateRun($1; $2)))
	This:C1470._addRoute("POST"; "/api/workflows/:workflowId/start-async"; Formula:C1597(This:C1470._workflowStartAsync($1; $2)))
	This:C1470._addRoute("POST"; "/api/workflows/:workflowId/stream"; Formula:C1597(This:C1470._workflowStream($1; $2)))
	This:C1470._addRoute("POST"; "/api/workflows/:workflowId/resume"; Formula:C1597(This:C1470._workflowResume($1; $2)))
	This:C1470._addRoute("GET"; "/api/workflows/:workflowId/runs"; Formula:C1597(This:C1470._listWorkflowRuns($1; $2)))
	This:C1470._addRoute("GET"; "/api/workflows/:workflowId/runs/:runId"; Formula:C1597(This:C1470._getWorkflowRun($1; $2)))
	// Tools
	This:C1470._addRoute("GET"; "/api/tools"; Formula:C1597(This:C1470._listTools($1; $2)))
	This:C1470._addRoute("GET"; "/api/tools/:toolId"; Formula:C1597(This:C1470._getTool($1; $2)))
	This:C1470._addRoute("POST"; "/api/tools/:toolId/execute"; Formula:C1597(This:C1470._executeTool($1; $2)))
	// Telemetry
	This:C1470._addRoute("GET"; "/api/telemetry/traces"; Formula:C1597(This:C1470._listTraces($1; $2)))
	This:C1470._addRoute("GET"; "/api/telemetry/traces/:traceId"; Formula:C1597(This:C1470._getTrace($1; $2)))
	This:C1470._addRoute("GET"; "/api/telemetry/traces/:traceId/spans"; Formula:C1597(This:C1470._getTraceSpans($1; $2)))
	// Logs
	This:C1470._addRoute("GET"; "/api/logs"; Formula:C1597(This:C1470._listLogs($1; $2)))
	This:C1470._addRoute("GET"; "/api/logs/:runId"; Formula:C1597(This:C1470._getLogsByRun($1; $2)))
	// Scorers
	This:C1470._addRoute("GET"; "/api/scorers"; Formula:C1597(This:C1470._listScorers($1; $2)))
	This:C1470._addRoute("GET"; "/api/scorers/:scorerId/scores"; Formula:C1597(This:C1470._getScorerScores($1; $2)))
	// A2A
	This:C1470._addRoute("POST"; "/api/a2a"; Formula:C1597(This:C1470._a2aRequest($1; $2)))
	This:C1470._addRoute("GET"; "/api/a2a/cards"; Formula:C1597(This:C1470._a2aCards($1; $2)))
	
Function handle($url : Text; $header : Text) : Boolean
	var $req:=cs:C1710.Request.new($url)
	var $res:=cs:C1710.Response.new()
	
	var $route:=This:C1470._matchRoute($req.method; $req.path)
	If ($route#Null:C1517)
		$req.params:=$route.params
		$route.handler.call(This:C1470; $req; $res)
		return True:C214
	End if 
	
	$res.status(404).json(New object:C1471("error"; "Not found"; "path"; $req.path))
	return True:C214
	
Function _addRoute($method : Text; $path : Text; $handler : Variant)
	This:C1470._routes.push(New object:C1471("method"; $method; "path"; $path; "handler"; $handler; "pattern"; This:C1470._pathToPattern($path)))
	
Function _pathToPattern($path : Text) : Text
	var $p:=Replace string:C233($path; ":agentId"; "([^/]+)")
	$p:=Replace string:C233($p; ":workflowId"; "([^/]+)")
	$p:=Replace string:C233($p; ":toolId"; "([^/]+)")
	$p:=Replace string:C233($p; ":traceId"; "([^/]+)")
	$p:=Replace string:C233($p; ":runId"; "([^/]+)")
	$p:=Replace string:C233($p; ":scorerId"; "([^/]+)")
	$p:=Replace string:C233($p; "."; "\\.")
	$p:="^"+$p+"$"
	return $p
	
Function _extractParams($path : Text; $routePath : Text; $actualPath : Text) : Object
	var $params:=New object:C1471
	var $routeParts:=Split string:C1554($routePath; "/")
	var $actualParts:=Split string:C1554($actualPath; "/")
	var $i : Integer
	For ($i; 1; $routeParts.length)
		If ($i<=$actualParts.length)
			var $rp : Variant:=$routeParts[$i-1]
			If (Position:C15(":"; $rp)=1)
				$params[Substring:C12($rp; 2)]:=$actualParts[$i]
			End if 
		End if 
	End for 
	return $params
	
Function _matchRoute($method : Text; $path : Text) : Object
	var $route : Object
	For each ($route; This:C1470._routes)
		If ($route.method=$method) && (Match regex:C1019($route.pattern; $path))
			$route.params:=This:C1470._extractParams($path; $route.path; $path)
			return $route
		End if 
	End for each 
	return Null:C1517
	
	// Route handlers
Function _listAgents($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $list : Collection:=New collection:C1472
	var $key : Text
	For each ($key; This:C1470._mind.agents)
		var $agent : cs:C1710.Agent:=This:C1470._mind.agents[$key]
		$list.push(New object:C1471("id"; $agent.id; "name"; $agent.name))
	End for each 
	$res.json(New object:C1471("data"; $list))
	
Function _getAgent($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $agent:=This:C1470._mind.getAgent($req.params.agentId)
	If ($agent=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Agent not found"))
		return 
	End if 
	$res.json(New object:C1471("id"; $agent.id; "name"; $agent.name; "model"; $agent.model))
	
Function _agentGenerate($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $agent:=This:C1470._mind.getAgent($req.params.agentId)
	If ($agent=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Agent not found"))
		return 
	End if 
	var $message : Text:=$req.body.message || $req.body.prompt || ""
	If ($message="")
		$res.status(400).json(New object:C1471("error"; "message or prompt required"))
		return 
	End if 
	Try
		var $result:=$agent.prompt($message)
		$res.json(New object:C1471("text"; $result.choice.message.content; "success"; $result.success))
	Catch
		$res.status(500).json(New object:C1471("error"; Last errors:C1799.last().message))
	End try
	
Function _agentStream($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.status(501).json(New object:C1471("error"; "Streaming not yet implemented"))
	
Function _listAgentTools($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $agent:=This:C1470._mind.getAgent($req.params.agentId)
	If ($agent=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Agent not found"))
		return 
	End if 
	var $list : Collection:=New collection:C1472
	var $tool : cs:C1710.Tool
	For each ($tool; $agent.tools)
		$list.push(New object:C1471("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	End for each 
	$res.json(New object:C1471("data"; $list))
	
Function _executeAgentTool($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $agent:=This:C1470._mind.getAgent($req.params.agentId)
	If ($agent=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Agent not found"))
		return 
	End if 
	var $toolId : Text:=$req.params.toolId
	var $tool : cs:C1710.Tool
	For each ($tool; $agent.tools)
		If ($tool.id=$toolId) || ($tool.name=$toolId)
			var $input : Object:=$req.body.input || $req.body || New object:C1471
			Try
				var $result:=$tool.execute($input)
				$res.json(New object:C1471("result"; $result))
			Catch
				$res.status(500).json(New object:C1471("error"; Last errors:C1799.last().message))
			End try
			return 
		End if 
	End for each 
	$res.status(404).json(New object:C1471("error"; "Tool not found"))
	
Function _listWorkflows($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $list : Collection:=New collection:C1472
	var $key : Text
	For each ($key; This:C1470._mind.workflows)
		var $wf : cs:C1710.Workflow:=This:C1470._mind.workflows[$key]
		$list.push(New object:C1471("id"; $wf.id; "name"; $wf.name))
	End for each 
	$res.json(New object:C1471("data"; $list))
	
Function _getWorkflow($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $wf:=This:C1470._mind.getWorkflow($req.params.workflowId)
	If ($wf=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Workflow not found"))
		return 
	End if 
	$res.json(New object:C1471("id"; $wf.id; "name"; $wf.name))
	
Function _workflowCreateRun($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $wf:=This:C1470._mind.getWorkflow($req.params.workflowId)
	If ($wf=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Workflow not found"))
		return 
	End if 
	var $input : Object:=$req.body.input || $req.body || New object:C1471
	// Inject mind so workflow steps can get agents
	$input._mind:=This:C1470._mind
	Try
		var $result:=$wf.run($input)
		$res.json(New object:C1471("runId"; "run-"+String:C10(Current date:C33); "result"; $result))
	Catch
		$res.status(500).json(New object:C1471("error"; Last errors:C1799.last().message))
	End try
	
Function _workflowStartAsync($req : cs:C1710.Request; $res : cs:C1710.Response)
	This:C1470._workflowCreateRun($req; $res)
	
Function _workflowStream($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.status(501).json(New object:C1471("error"; "Workflow stream not yet implemented"))
	
Function _workflowResume($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.status(501).json(New object:C1471("error"; "Workflow resume not yet implemented"))
	
Function _listWorkflowRuns($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.json(New object:C1471("data"; New collection:C1472))
	
Function _getWorkflowRun($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.status(404).json(New object:C1471("error"; "Run not found"))
	
Function _listTools($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $list : Collection:=New collection:C1472
	var $key : Text
	For each ($key; This:C1470._mind.tools)
		var $tool : cs:C1710.Tool:=This:C1470._mind.tools[$key]
		$list.push(New object:C1471("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	End for each 
	$res.json(New object:C1471("data"; $list))
	
Function _getTool($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $tool:=This:C1470._mind.getTool($req.params.toolId)
	If ($tool=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Tool not found"))
		return 
	End if 
	$res.json(New object:C1471("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	
Function _executeTool($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $tool:=This:C1470._mind.getTool($req.params.toolId)
	If ($tool=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Tool not found"))
		return 
	End if 
	var $input : Object:=$req.body.input || $req.body || New object:C1471
	Try
		var $result:=$tool.execute($input)
		$res.json(New object:C1471("result"; $result))
	Catch
		$res.status(500).json(New object:C1471("error"; Last errors:C1799.last().message))
	End try
	
Function _listTraces($req : cs:C1710.Request; $res : cs:C1710.Response)
	If (This:C1470._mind.getStorage()#Null:C1517)
		$res.json(New object:C1471("data"; This:C1470._mind.getStorage().listTraces(New object:C1471)))
	Else 
		$res.json(New object:C1471("data"; New collection:C1472))
	End if 
	
Function _getTrace($req : cs:C1710.Request; $res : cs:C1710.Response)
	If (This:C1470._mind.getStorage()=Null:C1517)
		$res.status(404).json(New object:C1471("error"; "Trace not found"))
		return 
	End if 
	var $trace:=This:C1470._mind.getStorage().getTrace($req.params.traceId)
	If ($trace#Null:C1517)
		$res.json($trace)
	Else 
		$res.status(404).json(New object:C1471("error"; "Trace not found"))
	End if 
	
Function _getTraceSpans($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.json(New object:C1471("data"; New collection:C1472))
	
Function _listLogs($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.json(New object:C1471("data"; New collection:C1472))
	
Function _getLogsByRun($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.json(New object:C1471("data"; New collection:C1472))
	
Function _listScorers($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $list : Collection:=New collection:C1472
	var $key : Text
	For each ($key; This:C1470._mind.scorers)
		var $scorer : cs:C1710.Scorer:=This:C1470._mind.scorers[$key]
		$list.push(New object:C1471("id"; $scorer.id; "name"; $scorer.name))
	End for each 
	$res.json(New object:C1471("data"; $list))
	
Function _getScorerScores($req : cs:C1710.Request; $res : cs:C1710.Response)
	$res.json(New object:C1471("data"; New collection:C1472))
	
Function _a2aRequest($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $a2a:=cs:C1710.A2A.new(This:C1470._mind)
	var $body:=$req.body
	If ($body=Null:C1517)
		$body:=New object:C1471
	End if 
	var $response:=$a2a.handleRequest($body)
	$res.json($response)
	
Function _a2aCards($req : cs:C1710.Request; $res : cs:C1710.Response)
	var $a2a:=cs:C1710.A2A.new(This:C1470._mind)
	$res.json(New object:C1471("cards"; $a2a.getAgentCards()))
	