// ORDAMind
// Central entry point - wires agents, workflows, tools, scorers, storage, logger, observability

property agents : Object
property workflows : Object
property tools : Object
property scorers : Object
property storage : cs.ORDAMindStorageBase
property logger : cs.ORDAMindLogger
property observability : cs.ORDAMindObservability

property _router : cs.ORDAMindRouter
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

Function getAgent($id : Text) : cs.ORDAMindAgent
	If (This.agents[$id]#Null)
		return This.agents[$id]
	End if
	return Null

Function getWorkflow($id : Text) : cs.ORDAMindWorkflow
	If (This.workflows[$id]#Null)
		return This.workflows[$id]
	End if
	return Null

Function getTool($id : Text) : cs.ORDAMindTool
	If (This.tools[$id]#Null)
		return This.tools[$id]
	End if
	return Null

Function getScorer($id : Text) : cs.ORDAMindScorer
	If (This.scorers[$id]#Null)
		return This.scorers[$id]
	End if
	return Null

Function getStorage() : cs.ORDAMindStorageBase
	return This.storage

Function getLogger() : cs.ORDAMindLogger
	return This.logger

Function getObservability() : cs.ORDAMindObservability
	return This.observability

Function start($settings : Object)
	If (This._started)
		return
	End if
	
	This._router:=cs.ORDAMindRouter.new(This)
	This._router.setupRoutes()
	
	// Store router for host's On Web Connection to call
	// Host implements: If Position("/api"; $url)=1 Then cs.ORDAMindRouter.me.handle($url; $header)
	// The router instance is held by ORDAMind; host gets it via $mind.getRouter()
	This._started:=True
	
	If (This.logger#Null) && ($settings#Null)
		This.logger.info("ORDAMind started"; New object("port"; $settings.port; "host"; $settings.host))
	End if

Function getRouter() : cs.ORDAMindRouter
	return This._router
