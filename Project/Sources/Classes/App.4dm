// App
// Central entry point - wires agents, workflows, tools, scorers, storage, logger, observability

property agents : Object
property workflows : Object
property tools : Object
property scorers : Object
property storage : cs.StorageBase
property logger : cs.Logger
property observability : cs.Observability

property _router : cs.Router
property _started : Boolean

Class constructor($config : Object)
	If ($config=Null)
		return
	End if
	
	This.agents:=($config.agents#Null) ? $config.agents : New object
	This.workflows:=($config.workflows#Null) ? $config.workflows : New object
	This.tools:=($config.tools#Null) ? $config.tools : New object
	This.scorers:=($config.scorers#Null) ? $config.scorers : New object
	This.storage:=$config.storage
	This.logger:=$config.logger
	This.observability:=$config.observability
	
	This._started:=False

Function getAgent($id : Text) : cs.Agent
	If (This.agents[$id]#Null)
		return This.agents[$id]
	End if
	return Null

Function getWorkflow($id : Text) : cs.Workflow
	If (This.workflows[$id]#Null)
		return This.workflows[$id]
	End if
	return Null

Function getTool($id : Text) : cs.Tool
	If (This.tools[$id]#Null)
		return This.tools[$id]
	End if
	return Null

Function getScorer($id : Text) : cs.Scorer
	If (This.scorers[$id]#Null)
		return This.scorers[$id]
	End if
	return Null

Function getStorage() : cs.StorageBase
	return This.storage

Function getLogger() : cs.Logger
	return This.logger

Function getObservability() : cs.Observability
	return This.observability

Function start($settings : Object)
	If (This._started)
		return
	End if
	
	This._router:=cs.Router.new(This)
	This._router.setupRoutes()
	
	// Store router for host's On Web Connection to call
	// Host implements: If Position("/api"; $url)=1 Then cs.Router.me.handle($url; $header)
	// The router instance is held by ; host gets it via $mind.getRouter()
	This._started:=True
	
	If (This.logger#Null) && ($settings#Null)
		This.logger.info(" started"; New object("port"; $settings.port; "host"; $settings.host))
	End if

Function getRouter() : cs.Router
	return This._router
