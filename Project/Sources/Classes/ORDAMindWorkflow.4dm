// ORDAMindWorkflow
// Workflow engine with .then(), .parallel(), .branch()
// run($input) executes the graph

property id : Text
property name : Text
property _nodes : Collection

Class constructor($config : Object)
	If ($config=Null)
		This._nodes:=New collection
		return
	End if
	
	This.id:=$config.id || $config.name || ""
	This.name:=($config.name#Null) ? $config.name : This.id
	This._nodes:=New collection

// Sequential: add step, output of N is input to N+1
Function then($step : cs.ORDAMindStep) : cs.ORDAMindWorkflow
	This._nodes.push(New object("type"; "step"; "data"; $step))
	return This

// Parallel: run steps simultaneously, next receives object keyed by step id
Function parallel($steps : Collection) : cs.ORDAMindWorkflow
	This._nodes.push(New object("type"; "parallel"; "data"; $steps))
	return This

// Branch: each branch is [condition Formula, step]; first matching runs
Function branch($branches : Collection) : cs.ORDAMindWorkflow
	This._nodes.push(New object("type"; "branch"; "data"; $branches))
	return This

Function run($input : Object) : Variant
	var $current : Variant:=$input
	
	var $node : Object
	For each ($node; This._nodes)
		Case of
			: ($node.type="step")
				var $step:=$node.data
				If (OB Instance of($step; cs.ORDAMindStep))
					$current:=$step.run($current)
				End if
				
			: ($node.type="parallel")
				var $steps:=$node.data
				var $results : Object:=New object
				var $s : cs.ORDAMindStep
				For each ($s; $steps)
					If (OB Instance of($s; cs.ORDAMindStep))
						$results[$s.id]:=$s.run($current)
					End if
				End for each
				$current:=$results
				
			: ($node.type="branch")
				var $branches:=$node.data
				var $branch : Collection
				For each ($branch; $branches)
					If (Value type($branch)#Is collection) || ($branch.length<2)
						continue
					End if
					var $condition:=$branch[1]
					var $step:=$branch[2]
					If (OB Instance of($condition; 4D.Function))
						If ($condition.call(Null; $current))
							If (OB Instance of($step; cs.ORDAMindStep))
								$current:=$step.run($current)
							End if
							Break
						End if
					End if
				End for each
		End case
	End for each
	
	return $current
