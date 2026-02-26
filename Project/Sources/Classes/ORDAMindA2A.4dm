// ORDAMindA2A
// A2A (Agent-to-Agent) Protocol support
// JSON-RPC 2.0 over HTTP; Agent Cards for discovery

property _mind : cs.ORDAMind

Class constructor($mind : cs.ORDAMind)
	This._mind:=$mind
	
	// Handle A2A JSON-RPC request
Function handleRequest($body : Object) : Object
	If ($body=Null)
		return This._jsonRpcError(-32700; "Parse error")
	End if 
	
	var $method:=$body.method
	var $params:=$body.params
	var $id:=$body.id
	
	If ($method=Null)
		return This._jsonRpcError(-32600; "Invalid Request"; $id)
	End if 
	
	var $result : Variant
	Case of 
		: ($method="tasks/create")
			$result:=This._tasksCreate($params)
		: ($method="tasks/update")
			$result:=This._tasksUpdate($params)
		: ($method="tasks/cancel")
			$result:=This._tasksCancel($params)
		: ($method="tasks/list")
			$result:=This._tasksList($params)
		Else 
			return This._jsonRpcError(-32601; "Method not found: "+$method; $id)
	End case 
	
	return New object("jsonrpc"; "2.0"; "result"; $result; "id"; $id)
	
Function _tasksCreate($params : Object) : Object
	// Create a new task - delegate to agent
	var $agentId:=$params.agentId || $params.agent_id
	var $input:=$params.input || $params
	var $agent:=This._mind.getAgent($agentId)
	If ($agent=Null)
		return New object("error"; "Agent not found")
	End if 
	
	var $taskId:="task-"+String(Current date)
	$taskId:=Replace string($taskId; " "; "-")
	$taskId:=Replace string($taskId; ":"; "")
	
	Try
		var $result:=$agent.prompt($input.message || $input.prompt || JSON Stringify($input))
		return New object("taskId"; $taskId; "status"; "completed"; "result"; $result.choice.message.content)
	Catch
		return New object("taskId"; $taskId; "status"; "failed"; "error"; Last errors.last().message)
	End try
	
Function _tasksUpdate($params : Object) : Object
	return New object("status"; "not_implemented")
	
Function _tasksCancel($params : Object) : Object
	return New object("status"; "cancelled")
	
Function _tasksList($params : Object) : Object
	return New object("tasks"; New collection)
	
Function _jsonRpcError($code : Integer; $message : Text; $id : Variant) : Object
	return New object("jsonrpc"; "2.0"; "error"; New object("code"; $code; "message"; $message); "id"; $id)
	
	// Get Agent Cards for discovery
Function getAgentCards() : Collection
	var $cards : Collection:=New collection
	var $key : Text
	For each ($key; This._mind.agents)
		var $agent:=This._mind.agents[$key]
		$cards.push(New object(\
			"@context"; "https://a2a-protocol.org/latest/"; \
			"name"; $agent.name; \
			"description"; "ORDAMind agent: "+$agent.name; \
			"url"; "/api/a2a"; \
			"agentId"; $agent.id\
			))
	End for each 
	return $cards
	