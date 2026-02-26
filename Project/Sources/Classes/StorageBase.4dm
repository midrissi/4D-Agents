// StorageBase
// Abstract storage interface - user implements persistence
// Subclasses override methods for ORDA dataclass, file-based, etc.

// Create or update an agent record
Function createAgent($agent : cs.Agent) : Object
	ASSERT(False; "StorageBase.createAgent not implemented")
	return Null

// Get agent by ID
Function getAgentById($id : Text) : Object
	ASSERT(False; "StorageBase.getAgentById not implemented")
	return Null

// List all agents
Function listAgents() : Collection
	ASSERT(False; "StorageBase.listAgents not implemented")
	return New collection

// Save a scorer run result
Function saveScore($scorerId : Text; $runInput : Object; $runOutput : Object; $score : Variant; $reason : Text) : Object
	ASSERT(False; "StorageBase.saveScore not implemented")
	return Null

// Save a trace
Function saveTrace($trace : Object) : Object
	ASSERT(False; "StorageBase.saveTrace not implemented")
	return Null

// Get trace by ID
Function getTrace($traceId : Text) : Object
	ASSERT(False; "StorageBase.getTrace not implemented")
	return Null

// List traces (optional filters)
Function listTraces($filters : Object) : Collection
	ASSERT(False; "StorageBase.listTraces not implemented")
	return New collection
