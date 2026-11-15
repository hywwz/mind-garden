let networkFocusInstalled=false;
function networkShowRoot(id){if(!semanticNodes.has(id))return;const before=new Set(branchCompute().exposed);branchRevealPath(id);branchExpanded.add(id);branchInvalidate();semanticSelect(id);branchPlaceChildren(id,before);forceWake();semanticFit(true);semanticPresent()}
const networkFocusInstall=installSemanticMap;
installSemanticMap=function(){networkFocusInstall();if(networkFocusInstalled)return;networkFocusInstalled=true;const home=semanticHome;semanticHome=function(){home();if(db.goals.length===1&&db.goals[0].networkImport?.level===1)networkShowRoot(db.goals[0].id)};$('#lifeHome').onclick=semanticHome;if(activeView==='life'&&db.goals.length===1&&db.goals[0].networkImport?.level===1)semanticHome()};

let networkOverviewShownFor=null;const networkSwitchView=switchView;switchView=function(view,...args){const result=networkSwitchView(view,...args),g=db.goals.length===1&&db.goals[0].networkImport?.level===1?db.goals[0]:null;if(view==='life'&&networkFocusInstalled&&g&&networkOverviewShownFor!==g.id){networkOverviewShownFor=g.id;semanticHome()}return result};
