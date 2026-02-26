// ORDAMindA2A
// A2A (Agent-to-Agent) Protocol support
// JSON-RPC 2.0 over HTTP; Agent Cards for discovery

property _mind : cs:C1710.ORDAMind

Class constructor($mind : cs:C1710.ORDAMind)
	This:C1470._mind:=$mind
	
	// Handle A2A JSON-RPC request
Function handleRequest($body : Object) : Object
	If ($body=Null:C1517)
		return This:C1470._jsonRpcError(-32700; "Parse error")
	End if 
	
	var $method:=$body.method
	var $params:=$body.params
	var $id:=$body.id
	
	If ($method=Null:C1517)
		return This:C1470._jsonRpcError(-32600; "Invalid Request"; $id)
	End if 
	
	var $result : Variant
	Case of 
		: ($method="tasks/create")
			$result:=This:C1470._tasksCreate($params)
		: ($method="tasks/update")
			$result:=This:C1470._tasksUpdate($params)
		: ($method="tasks/cancel")
			$result:=This:C1470._tasksCancel($params)
		: ($method="tasks/list")
			$result:=This:C1470._tasksList($params)
		Else 
			return This:C1470._jsonRpcError(-32601; "Method not found: "+$method; $id)
	End case 
	
	return New object:C1471("jsonrpc"; "2.0"; "result"; $result; "id"; $id)
	
Function _tasksCreate($params : Object) : Object
	// Create a new task - delegate to agent
	var $agentId:=$params.agentId || $params.agent_id
	var $input:=$params.input || $params
	var $agent:=This:C1470._mind.getAgent($agentId)
	If ($agent=Null:C1517)
		return New object:C1471("error"; "Agent not found")
	End if 
	
	var $taskId:="task-"+String:C10(Current date:C33)
	$taskId:=Replace string:C233($taskId; " "; "-")
	$taskId:=Replace string:C233($taskId; ":"; "")
	
	Try
		var $result:=$agent.prompt($input.message || $input.prompt || JSON Stringify:C1217($input))
		return New object:C1471("taskId"; $taskId; "status"; "completed"; "result"; $result.choice.message.content)
	Catch
		return New object:C1471("taskId"; $taskId; "status"; "failed"; "error"; Last errors:C1799.last().message)
	End try
	
Function _tasksUpdate($params : Object) : Object
	return New object:C1471("status"; "not_implemented")
	
Function _tasksCancel($params : Object) : Object
	return New object:C1471("status"; "cancelled")
	
Function _tasksList($params : Object) : Object
	return New object:C1471("tasks"; New collection:C1472)
	
Function _jsonRpcError($code : Integer; $message : Text; $id : Variant) : Object
	return New object:C1471("jsonrpc"; "2.0"; "error"; New object:C1471("code"; $code; "message"; $message); "id"; $id)
	
	// Get Agent Cards for discovery
Function getAgentCards() : Collection
	var $cards : Collection:=New collection:C1472
	var $key : Text
	For each ($key; This:C1470._mind.agents)
		var $agent:=This:C1470._mind.agents[$key]
		$cards.push(New object:C1471(\
			"@context"; "https://a2a-protocol.org/latest/"; \
			"name"; $agent.name; \
			"description"; "ORDAMind agent: "+$agent.name; \
			"url"; "/api/a2a"; \
			"agentId"; $agent.id\
			))
	End for each 
	return $cards
	