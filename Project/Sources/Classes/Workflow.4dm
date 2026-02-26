// Workflow
// Workflow engine with .then(), .parallel(), .branch()
// run($input) executes the graph

property id : Text
property name : Text
property _nodes : Collection

Class constructor($config : Object)
	If ($config=Null:C1517)
		This:C1470._nodes:=New collection:C1472
		return 
	End if 
	
	This:C1470.id:=$config.id || $config.name || ""
	This:C1470.name:=($config.name#Null:C1517) ? $config.name : This:C1470.id
	This:C1470._nodes:=New collection:C1472
	
	// Sequential: add step, output of N is input to N+1
Function then($step : cs:C1710.Step) : cs:C1710.Workflow
	This:C1470._nodes.push(New object:C1471("type"; "step"; "data"; $step))
	return This:C1470
	
	// Parallel: run steps simultaneously, next receives object keyed by step id
Function parallel($steps : Collection) : cs:C1710.Workflow
	This:C1470._nodes.push(New object:C1471("type"; "parallel"; "data"; $steps))
	return This:C1470
	
	// Branch: each branch is [condition Formula, step]; first matching runs
Function branch($branches : Collection) : cs:C1710.Workflow
	This:C1470._nodes.push(New object:C1471("type"; "branch"; "data"; $branches))
	return This:C1470
	
Function run($input : Object) : Variant
	var $current : Variant:=$input
	
	var $node : Object
	For each ($node; This:C1470._nodes)
		Case of 
			: ($node.type="step")
				var $step : Variant:=$node.data
				If (OB Instance of:C1731($step; cs:C1710.Step))
					$current:=$step.run($current)
				End if 
				
			: ($node.type="parallel")
				var $steps : Variant:=$node.data
				var $results : Object:=New object:C1471
				var $s : cs:C1710.Step
				For each ($s; $steps)
					If (OB Instance of:C1731($s; cs:C1710.Step))
						$results[$s.id]:=$s.run($current)
					End if 
				End for each 
				$current:=$results
				
			: ($node.type="branch")
				var $branches : Variant:=$node.data
				var $branch : Collection
				For each ($branch; $branches)
					If (Value type:C1509($branch)#Is collection:K8:32) || ($branch.length<2)
						continue
					End if 
					var $condition : Variant:=$branch[1]
					$step:=$branch[2]
					If (OB Instance of:C1731($condition; 4D:C1709.Function))
						If ($condition.call(Null:C1517; $current))
							If (OB Instance of:C1731($step; cs:C1710.Step))
								$current:=$step.run($current)
							End if 
							break
						End if 
					End if 
				End for each 
		End case 
	End for each 
	
	return $current
	