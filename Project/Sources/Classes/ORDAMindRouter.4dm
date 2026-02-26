// ORDAMindRouter
// Express-like router for On Web Connection
// Parses request via WEB GET HTTP HEADER, WEB GET HTTP BODY; matches routes; sends via WEB SEND RAW DATA

property _mind : cs.ORDAMind
property _routes : Collection

Class constructor($mind : cs.ORDAMind)
	This._mind:=$mind
	This._routes:=New collection
	
Function setupRoutes()
	// Agents
	This._addRoute("GET"; "/api/agents"; Formula(This._listAgents($1; $2)))
	This._addRoute("GET"; "/api/agents/:agentId"; Formula(This._getAgent($1; $2)))
	This._addRoute("POST"; "/api/agents/:agentId/generate"; Formula(This._agentGenerate($1; $2)))
	This._addRoute("POST"; "/api/agents/:agentId/stream"; Formula(This._agentStream($1; $2)))
	This._addRoute("GET"; "/api/agents/:agentId/tools"; Formula(This._listAgentTools($1; $2)))
	This._addRoute("POST"; "/api/agents/:agentId/tools/:toolId/execute"; Formula(This._executeAgentTool($1; $2)))
	// Workflows
	This._addRoute("GET"; "/api/workflows"; Formula(This._listWorkflows($1; $2)))
	This._addRoute("GET"; "/api/workflows/:workflowId"; Formula(This._getWorkflow($1; $2)))
	This._addRoute("POST"; "/api/workflows/:workflowId/create-run"; Formula(This._workflowCreateRun($1; $2)))
	This._addRoute("POST"; "/api/workflows/:workflowId/start-async"; Formula(This._workflowStartAsync($1; $2)))
	This._addRoute("POST"; "/api/workflows/:workflowId/stream"; Formula(This._workflowStream($1; $2)))
	This._addRoute("POST"; "/api/workflows/:workflowId/resume"; Formula(This._workflowResume($1; $2)))
	This._addRoute("GET"; "/api/workflows/:workflowId/runs"; Formula(This._listWorkflowRuns($1; $2)))
	This._addRoute("GET"; "/api/workflows/:workflowId/runs/:runId"; Formula(This._getWorkflowRun($1; $2)))
	// Tools
	This._addRoute("GET"; "/api/tools"; Formula(This._listTools($1; $2)))
	This._addRoute("GET"; "/api/tools/:toolId"; Formula(This._getTool($1; $2)))
	This._addRoute("POST"; "/api/tools/:toolId/execute"; Formula(This._executeTool($1; $2)))
	// Telemetry
	This._addRoute("GET"; "/api/telemetry/traces"; Formula(This._listTraces($1; $2)))
	This._addRoute("GET"; "/api/telemetry/traces/:traceId"; Formula(This._getTrace($1; $2)))
	This._addRoute("GET"; "/api/telemetry/traces/:traceId/spans"; Formula(This._getTraceSpans($1; $2)))
	// Logs
	This._addRoute("GET"; "/api/logs"; Formula(This._listLogs($1; $2)))
	This._addRoute("GET"; "/api/logs/:runId"; Formula(This._getLogsByRun($1; $2)))
	// Scorers
	This._addRoute("GET"; "/api/scorers"; Formula(This._listScorers($1; $2)))
	This._addRoute("GET"; "/api/scorers/:scorerId/scores"; Formula(This._getScorerScores($1; $2)))
	// A2A
	This._addRoute("POST"; "/api/a2a"; Formula(This._a2aRequest($1; $2)))
	This._addRoute("GET"; "/api/a2a/cards"; Formula(This._a2aCards($1; $2)))
	
Function handle($url : Text; $header : Text) : Boolean
	var $req:=cs.ORDAMindRequest.new($url)
	var $res:=cs.ORDAMindResponse.new()
	
	var $route:=This._matchRoute($req.method; $req.path)
	If ($route#Null)
		$req.params:=$route.params
		$route.handler.call(This; $req; $res)
		return True
	End if 
	
	$res.status(404).json(New object("error"; "Not found"; "path"; $req.path))
	return True
	
Function _addRoute($method : Text; $path : Text; $handler : Variant)
	This._routes.push(New object("method"; $method; "path"; $path; "handler"; $handler; "pattern"; This._pathToPattern($path)))
	
Function _pathToPattern($path : Text) : Text
	var $p:=Replace string($path; ":agentId"; "([^/]+)")
	$p:=Replace string($p; ":workflowId"; "([^/]+)")
	$p:=Replace string($p; ":toolId"; "([^/]+)")
	$p:=Replace string($p; ":traceId"; "([^/]+)")
	$p:=Replace string($p; ":runId"; "([^/]+)")
	$p:=Replace string($p; ":scorerId"; "([^/]+)")
	$p:=Replace string($p; "."; "\\.")
	$p:="^"+$p+"$"
	return $p
	
Function _extractParams($path : Text; $routePath : Text; $actualPath : Text) : Object
	var $params:=New object
	var $routeParts:=Split string($routePath; "/")
	var $actualParts:=Split string($actualPath; "/")
	var $i : Integer
	For ($i; 1; $routeParts.length)
		If ($i<=$actualParts.length)
			var $rp:=$routeParts[$i]
			If (Position(":"; $rp)=1)
				$params[Substring($rp; 2)]:=$actualParts[$i]
			End if 
		End if 
	End for 
	return $params
	
Function _matchRoute($method : Text; $path : Text) : Object
	var $route : Object
	For each ($route; This._routes)
		If ($route.method=$method) && (Match regex($route.pattern; $path))
			$route.params:=This._extractParams($path; $route.path; $path)
			return $route
		End if 
	End for each 
	return Null
	
	// Route handlers
Function _listAgents($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $list : Collection:=New collection
	var $key : Text
	For each ($key; This._mind.agents)
		var $agent:=This._mind.agents[$key]
		$list.push(New object("id"; $agent.id; "name"; $agent.name))
	End for each 
	$res.json(New object("data"; $list))
	
Function _getAgent($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $agent:=This._mind.getAgent($req.params.agentId)
	If ($agent=Null)
		$res.status(404).json(New object("error"; "Agent not found"))
		return 
	End if 
	$res.json(New object("id"; $agent.id; "name"; $agent.name; "model"; $agent.model))
	
Function _agentGenerate($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $agent:=This._mind.getAgent($req.params.agentId)
	If ($agent=Null)
		$res.status(404).json(New object("error"; "Agent not found"))
		return 
	End if 
	var $message:=$req.body.message || $req.body.prompt || ""
	If ($message="")
		$res.status(400).json(New object("error"; "message or prompt required"))
		return 
	End if 
	Try
		var $result:=$agent.prompt($message)
		$res.json(New object("text"; $result.choice.message.content; "success"; $result.success))
	Catch
		$res.status(500).json(New object("error"; Last errors.last().message))
	End try
	
Function _agentStream($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.status(501).json(New object("error"; "Streaming not yet implemented"))
	
Function _listAgentTools($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $agent:=This._mind.getAgent($req.params.agentId)
	If ($agent=Null)
		$res.status(404).json(New object("error"; "Agent not found"))
		return 
	End if 
	var $list : Collection:=New collection
	var $tool : cs.ORDAMindTool
	For each ($tool; $agent.tools)
		$list.push(New object("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	End for each 
	$res.json(New object("data"; $list))
	
Function _executeAgentTool($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $agent:=This._mind.getAgent($req.params.agentId)
	If ($agent=Null)
		$res.status(404).json(New object("error"; "Agent not found"))
		return 
	End if 
	var $toolId:=$req.params.toolId
	var $tool : cs.ORDAMindTool
	For each ($tool; $agent.tools)
		If ($tool.id=$toolId) || ($tool.name=$toolId)
			var $input:=$req.body.input || $req.body || New object
			Try
				var $result:=$tool.execute($input)
				$res.json(New object("result"; $result))
			Catch
				$res.status(500).json(New object("error"; Last errors.last().message))
			End try
			return 
		End if 
	End for each 
	$res.status(404).json(New object("error"; "Tool not found"))
	
Function _listWorkflows($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $list : Collection:=New collection
	var $key : Text
	For each ($key; This._mind.workflows)
		var $wf:=This._mind.workflows[$key]
		$list.push(New object("id"; $wf.id; "name"; $wf.name))
	End for each 
	$res.json(New object("data"; $list))
	
Function _getWorkflow($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $wf:=This._mind.getWorkflow($req.params.workflowId)
	If ($wf=Null)
		$res.status(404).json(New object("error"; "Workflow not found"))
		return 
	End if 
	$res.json(New object("id"; $wf.id; "name"; $wf.name))
	
Function _workflowCreateRun($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $wf:=This._mind.getWorkflow($req.params.workflowId)
	If ($wf=Null)
		$res.status(404).json(New object("error"; "Workflow not found"))
		return 
	End if 
	var $input:=$req.body.input || $req.body || New object
	// Inject mind so workflow steps can get agents
	$input._mind:=This._mind
	Try
		var $result:=$wf.run($input)
		$res.json(New object("runId"; "run-"+String(Current date); "result"; $result))
	Catch
		$res.status(500).json(New object("error"; Last errors.last().message))
	End try
	
Function _workflowStartAsync($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	This._workflowCreateRun($req; $res)
	
Function _workflowStream($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.status(501).json(New object("error"; "Workflow stream not yet implemented"))
	
Function _workflowResume($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.status(501).json(New object("error"; "Workflow resume not yet implemented"))
	
Function _listWorkflowRuns($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.json(New object("data"; New collection))
	
Function _getWorkflowRun($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.status(404).json(New object("error"; "Run not found"))
	
Function _listTools($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $list : Collection:=New collection
	var $key : Text
	For each ($key; This._mind.tools)
		var $tool:=This._mind.tools[$key]
		$list.push(New object("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	End for each 
	$res.json(New object("data"; $list))
	
Function _getTool($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $tool:=This._mind.getTool($req.params.toolId)
	If ($tool=Null)
		$res.status(404).json(New object("error"; "Tool not found"))
		return 
	End if 
	$res.json(New object("id"; $tool.id; "name"; $tool.name; "description"; $tool.description))
	
Function _executeTool($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $tool:=This._mind.getTool($req.params.toolId)
	If ($tool=Null)
		$res.status(404).json(New object("error"; "Tool not found"))
		return 
	End if 
	var $input:=$req.body.input || $req.body || New object
	Try
		var $result:=$tool.execute($input)
		$res.json(New object("result"; $result))
	Catch
		$res.status(500).json(New object("error"; Last errors.last().message))
	End try
	
Function _listTraces($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	If (This._mind.getStorage()#Null)
		$res.json(New object("data"; This._mind.getStorage().listTraces(New object)))
	Else 
		$res.json(New object("data"; New collection))
	End if 
	
Function _getTrace($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	If (This._mind.getStorage()=Null)
		$res.status(404).json(New object("error"; "Trace not found"))
		return 
	End if 
	var $trace:=This._mind.getStorage().getTrace($req.params.traceId)
	If ($trace#Null)
		$res.json($trace)
	Else 
		$res.status(404).json(New object("error"; "Trace not found"))
	End if 
	
Function _getTraceSpans($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.json(New object("data"; New collection))
	
Function _listLogs($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.json(New object("data"; New collection))
	
Function _getLogsByRun($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.json(New object("data"; New collection))
	
Function _listScorers($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $list : Collection:=New collection
	var $key : Text
	For each ($key; This._mind.scorers)
		var $scorer:=This._mind.scorers[$key]
		$list.push(New object("id"; $scorer.id; "name"; $scorer.name))
	End for each 
	$res.json(New object("data"; $list))
	
Function _getScorerScores($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	$res.json(New object("data"; New collection))
	
Function _a2aRequest($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $a2a:=cs.ORDAMindA2A.new(This._mind)
	var $body:=$req.body
	If ($body=Null)
		$body:=New object
	End if 
	var $response:=$a2a.handleRequest($body)
	$res.json($response)
	
Function _a2aCards($req : cs.ORDAMindRequest; $res : cs.ORDAMindResponse)
	var $a2a:=cs.ORDAMindA2A.new(This._mind)
	$res.json(New object("cards"; $a2a.getAgentCards()))
	