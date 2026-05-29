// 中科数控 · 客户服务中心 JS
var API='',sess={},_tab='repair',_sf='',_cart={},_photos=[];
// 滚动日期选择器
var _dpTarget=null,_dpYear=0,_dpMonth=0,_dpDay=0,_dpType='date';
function openDatePicker(targetId,type){
 _dpTarget=document.getElementById(targetId);_dpType=type||'date';
 var now=new Date();_dpYear=now.getFullYear();_dpMonth=now.getMonth()+1;_dpDay=now.getDate();
 if(_dpTarget&&_dpTarget.value){
  var parts=_dpTarget.value.split('-');
  if(parts.length>=3){_dpYear=parseInt(parts[0]);_dpMonth=parseInt(parts[1]);_dpDay=parseInt(parts[2]);}
 }
 // datetime-local: parse time too
 if(_dpType==='datetime'&&_dpTarget&&_dpTarget.value){
  var m=_dpTarget.value.match(/T(\d{2}):(\d{2})/);
  if(m){_dpHour=parseInt(m[1]);_dpMinute=parseInt(m[2]);}
 }
 renderDatePicker();document.getElementById('dpOverlay').classList.add('show');
}
var _dpHour=0,_dpMinute=0;
function renderDatePicker(){
 var cy=_dpYear,cm=_dpMonth,cd=_dpDay,ch=_dpHour,cmi=_dpMinute;
 var yHtml='';for(var y=cy-50;y<=cy+5;y++)yHtml+='<div class="dp-item'+(y===cy?' selected':'')+'" onclick="pickDP(\'y\','+y+')">'+y+'年</div>';
 var mHtml='';for(var m=1;m<=12;m++)mHtml+='<div class="dp-item'+(m===cm?' selected':'')+'" onclick="pickDP(\'m\','+m+')">'+String(m).padStart(2,'0')+'月</div>';
 var maxD=new Date(cy,cm,0).getDate();if(cd>maxD)cd=_dpDay=maxD;
 var dHtml='';for(var d=1;d<=maxD;d++)dHtml+='<div class="dp-item'+(d===cd?' selected':'')+'" onclick="pickDP(\'d\','+d+')">'+String(d).padStart(2,'0')+'日</div>';
 var cols='<div class="dp-col" id="dpColY">'+yHtml+'</div><div class="dp-col" id="dpColM">'+mHtml+'</div><div class="dp-col" id="dpColD">'+dHtml+'</div>';
 if(_dpType==='datetime'){
  var hHtml='';for(var h=0;h<24;h++)hHtml+='<div class="dp-item'+(h===ch?' selected':'')+'" onclick="pickDP(\'h\','+h+')">'+String(h).padStart(2,'0')+'时</div>';
  var miHtml='';for(var mi=0;mi<60;mi+=5)miHtml+='<div class="dp-item'+(mi===cmi?' selected':'')+'" onclick="pickDP(\'mi\','+mi+')">'+String(mi).padStart(2,'0')+'分</div>';
  cols+= '<div class="dp-col" id="dpColH">'+hHtml+'</div><div class="dp-col" id="dpColMi">'+miHtml+'</div>';
 }
 document.getElementById('dpColumns').innerHTML=cols;
 requestAnimationFrame(function(){
  scrollToSel('dpColY');scrollToSel('dpColM');scrollToSel('dpColD');
  if(_dpType==='datetime'){scrollToSel('dpColH');scrollToSel('dpColMi');}
 });
}
function scrollToSel(id){var c=document.getElementById(id);if(!c)return;var s=c.querySelector('.dp-item.selected');if(s)s.scrollIntoView({behavior:'instant',block:'center'});}
function pickDP(type,val){
 if(type==='y')_dpYear=val;else if(type==='m')_dpMonth=val;else if(type==='d')_dpDay=val;else if(type==='h')_dpHour=val;else if(type==='mi')_dpMinute=val;
 renderDatePicker();
}
function closeDatePicker(){document.getElementById('dpOverlay').classList.remove('show');_dpTarget=null;}
function confirmDatePicker(){
 if(!_dpTarget)return;
 var v=_dpYear+'-'+String(_dpMonth).padStart(2,'0')+'-'+String(_dpDay).padStart(2,'0');
 if(_dpType==='datetime')v+='T'+String(_dpHour).padStart(2,'0')+':'+String(_dpMinute).padStart(2,'0');
 _dpTarget.value=v;closeDatePicker();
}
// 用户下拉菜单
function toggleUserMenu(){
 var d=document.getElementById('userDrop');if(!d)return;
 if(d.classList.contains('show')){d.classList.remove('show');return;}
 // 渲染用户信息
 var i=sess.info||{};
 d.innerHTML='<div class="u-info"><div class="un">'+esc(sess.displayName||sess.phone)+'</div><div class="up">📞 '+esc(sess.phone)+(i.factoryName?' · 🏭 '+esc(i.factoryName.slice(0,12)):'')+'</div></div><button class="u-act" onclick="refreshPage();toggleUserMenu()">🔄 刷新同步</button><button class="u-act danger" onclick="logout()">🚪 退出登录</button>';
 d.classList.add('show');
}
function refreshPage(){_tab='repair';_sf='';_cart={};_photos=[];if(sess.phone){showDashboard('repair');toast('已刷新','s');}else{showLogin();toast('已刷新，请登录','i');}}
document.addEventListener('click',function(e){var d=document.getElementById('userDrop');if(d&&d.classList.contains('show')&&!e.target.closest('.user'))d.classList.remove('show');});

// 内置省市区备选数据（API不可用时使用）
var _regionCache=null;
function loadRegions(cb){
 if(_regionCache){cb(_regionCache);return;}
 api('/api/regions','GET').then(function(r){
  if(r.ok&&r.data&&r.data.length){_regionCache=r;cb(r);}else{cb(null);}
 }).catch(function(){cb(null);});
}
function loadCities(prov,cb){
 api('/api/regions?province='+encodeURIComponent(prov),'GET').then(function(r){
  if(r.ok&&r.data)cb(r.data);else cb([]);
 }).catch(function(){cb([]);});
}
function loadDistricts(prov,city,cb){
 api('/api/regions?province='+encodeURIComponent(prov)+'&city='+encodeURIComponent(city),'GET').then(function(r){
  if(r.ok&&r.data)cb(r.data);else cb([]);
 }).catch(function(){cb([]);});
}
function loadEquipParts(type,cb){
 api('/api/equipment-parts?type='+encodeURIComponent(type),'GET').then(function(r){
  if(r.ok&&r.data)cb(r.data);else cb(['其他']);
 }).catch(function(){cb(['其他']);});
}

function api(p,m,b,a){
 var o={method:m||'GET',headers:{'Content-Type':'application/json'}};
 if(a&&sess.token)o.headers['Authorization']='Bearer '+sess.token;
 if(b)o.body=JSON.stringify(b);
 return fetch(API+p,o).then(function(r){return r.json();});
}
function toast(msg,tp){tp=tp||'i';var c=document.getElementById('toasts'),d=document.createElement('div');d.className='toast '+tp;d.textContent=msg;c.appendChild(d);setTimeout(function(){d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(function(){d.remove();},300);},2200);}
function fmt(ts){if(!ts)return'';var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function fmtD(ts){if(!ts)return'';var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

function save(){try{localStorage.setItem('zk_sess',JSON.stringify(sess));}catch(e){}}function load(){try{var r=localStorage.getItem('zk_sess');if(r)sess=JSON.parse(r);}catch(e){}}
function userBar(){document.getElementById('userBar').innerHTML=sess.phone?'<button class="u-btn" onclick="toggleUserMenu()"><span class="avatar">'+(sess.displayName||sess.phone).charAt(0)+'</span><span>'+esc(sess.displayName||'')+'</span></button><button class="u-btn refresh" onclick="refreshPage()" id="refreshBtn" title="刷新同步">🔄</button><div class="u-drop" id="userDrop"></div>':'';}
function logout(){sess={};save();_cart={};userBar();showLogin();}

// GPS定位
function locateGPS(){
 if(!navigator.geolocation){toast('您的浏览器不支持GPS定位，请手动选择地区','e');return;}
 var btn=document.getElementById('locBtn');if(!btn)return;
 btn.classList.add('loading');btn.textContent='📍 正在定位...';
 navigator.geolocation.getCurrentPosition(function(pos){
  var lat=pos.coords.latitude,lon=pos.coords.longitude;
  fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon+'&accept-language=zh&zoom=12')
   .then(function(r){return r.json();})
   .then(function(data){
    btn.classList.remove('loading');btn.textContent='📍 定位当前位置';
    var addr=data.display_name||'',ad=data.address||{};
    document.getElementById('locAddr').textContent='✅ 已定位：'+addr.slice(0,50)+(addr.length>50?'...':'');
    document.getElementById('locAddr').style.color='var(--s)';
    var pv=ad.province||ad.state||'',cv=ad.city||ad.county||'',dv=ad.district||ad.town||'';
    if(pv){
     document.getElementById('rProv').innerHTML='<option>'+pv+'</option>';
     loadCities(pv,function(cities){
      fillSelect('rCity',cities,cv||cities[0]||'');
      var cit=cv||(cities[0]||'');
      loadDistricts(pv,cit,function(districts){fillSelect('rDist',districts,dv||districts[0]||'');});
     });
    }
   }).catch(function(){
    btn.classList.remove('loading');btn.textContent='📍 定位当前位置';
    document.getElementById('locAddr').textContent='📍 坐标: '+lat.toFixed(4)+', '+lon.toFixed(4)+'（请手动选择区域）';
   });
 },function(err){
  btn.classList.remove('loading');btn.textContent='📍 定位当前位置（需授权）';
  toast('无法获取位置：'+err.message,'e');
 },{enableHighAccuracy:true,timeout:8000,maximumAge:60000});
}

function fillSelect(id,list,selVal){
 var sel=document.getElementById(id);if(!sel)return;
 sel.innerHTML=list.map(function(v){return'<option value="'+v+'"'+(v===selVal?' selected':'')+'>'+v+'</option>';}).join('');
}

// ====== 登录 ======
function showLogin(){
 userBar();
 // 检查是否有保存的token尝试自动登录
 var saved=null;try{saved=JSON.parse(localStorage.getItem('zk_sess')||'null');}catch(e){}
 if(saved&&saved.phone&&saved.token){
  api('/api/customer/relogin','POST',{phone:saved.phone,token:saved.token}).then(function(r){
   if(r.ok){sess={phone:r.data.phone,displayName:r.data.displayName,info:r.data.info,token:r.data.token};save();userBar();showDashboard('repair');return;}
   renderLogin();
  }).catch(function(){renderLogin();});
  return;
 }
 renderLogin();
}
function renderLogin(){
 document.getElementById('app').innerHTML='<div class="login-box"><div style="width:80px;height:80px;margin:0 auto 12px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff;font-weight:bold">ZK</div><h1>中科数控售后报修平台</h1><p style="color:var(--ts);font-size:13px;margin-bottom:24px">广东中科数控科技有限公司</p><div class="card" style="text-align:left"><form onsubmit="return doLogin(event)" autocomplete="off" novalidate><div class="fg"><label>手机号码</label><input type="tel" id="lgPhone" placeholder="请输入手机号码" maxlength="11" style="font-size:16px;letter-spacing:1px" autocomplete="tel"></div><div class="fg"><label>登录密码</label><input type="password" id="lgPass" placeholder="请输入密码（管理员创建账号时设置）" style="font-size:16px" autocomplete="current-password"></div><button class="btn btn-p btn-block btn-lg" id="loginBtn" style="padding:12px;margin-top:6px">登 录</button></form><p style="text-align:center;margin-top:8px;font-size:10px;color:var(--ts)">账号由管理员创建 | 登录后长期有效无需重复登录</p></div><p style="margin-top:10px;font-size:11px;color:var(--ts)">广东中科数控科技有限公司 · 设备报修平台</p><p id="debugStatus" style="font-size:10px;color:var(--s);text-align:center;margin-top:6px"></p></div>';
}
function doLogin(e){e.preventDefault();
 var phone=document.getElementById('lgPhone').value.trim();
 var password=document.getElementById('lgPass').value.trim();
 if(!/^1[3-9]\d{9}$/.test(phone)){toast('请输入正确的手机号码','e');return false;}
 if(!password){toast('请输入密码','e');return false;}
 var loginBtn=document.getElementById('loginBtn');loginBtn.disabled=true;loginBtn.textContent='登录中...';
 api('/api/customer/login','POST',{phone:phone,password:password}).then(function(r){
  loginBtn.disabled=false;loginBtn.textContent='登录';
  if(r.ok){
   sess={phone:r.data.phone,displayName:r.data.displayName,info:r.data.info,token:r.data.token};
   save();userBar();
   toast('登录成功，欢迎使用中科数控售后系统','s');
   showDashboard('repair');
  }else toast(r.msg||'登录失败','e');
 }).catch(function(err){loginBtn.disabled=false;loginBtn.textContent='登录';toast('网络连接失败，请确认服务器是否运行','e');});
 return false;
}
// ====== 工作台 ======
function showDashboard(tab){_tab=tab||_tab;if(!sess.phone){showLogin();return;}userBar();
 Promise.all([api('/api/tasks?phone='+sess.phone),api('/api/parts'),api('/api/orders?phone='+sess.phone),api('/api/customer/info?phone='+sess.phone)]).then(function(r){
  var tasks=r[0].ok?r[0].data:[],parts=r[1].ok?r[1].data:[],orders=r[2].ok?r[2].data:[],info=r[3].ok?r[3].data:{};
  sess.info=info;save();
  var pc=0,cc=0;for(var j=0;j<tasks.length;j++){if(tasks[j].status==='pending'||tasks[j].status==='processing')pc++;if(tasks[j].status==='completed')cc++;}
  var unpaid=orders.filter(function(o){return o.status==='pending_payment';}).length;

  document.getElementById('app').innerHTML='<div class="stats">'+
   '<div class="stat" onclick="showDashboard(\'history\')"><div class="s-icon blue">📋</div><div><div class="s-num">'+tasks.length+'</div><div class="s-label">我的报修</div></div></div>'+
   '<div class="stat" onclick="showDashboard(\'history\')"><div class="s-icon orange">⏳</div><div><div class="s-num">'+pc+'</div><div class="s-label">处理中</div></div></div>'+
   '<div class="stat" onclick="showDashboard(\'history\')"><div class="s-icon green">✅</div><div><div class="s-num">'+cc+'</div><div class="s-label">已完成</div></div></div>'+
   '<div class="stat" onclick="showDashboard(\'orders\')"><div class="s-icon red">💳</div><div><div class="s-num">'+unpaid+'</div><div class="s-label">待付款</div></div></div>'+
   '<div class="stat" onclick="showDashboard(\'profile\')"><div class="s-icon blue">🏭</div><div><div class="s-num" style="font-size:12px">'+esc((info.factoryName||'未设置').slice(0,7))+'</div><div class="s-label">企业信息</div></div></div>'+
   '</div>'+
   '<div class="tabs">'+
   '<button class="tab '+(_tab==='repair'?'active':'')+'" onclick="showDashboard(\'repair\')">🔧 设备报修</button>'+
   '<button class="tab '+(_tab==='selfhelp'?'active':'')+'" onclick="showDashboard(\'selfhelp\')">🔍 自助查询</button>'+
   '<button class="tab '+(_tab==='parts'?'active':'')+'" onclick="showDashboard(\'parts\')">🛒 配件选购</button>'+
   '<button class="tab '+(_tab==='history'?'active':'')+'" onclick="showDashboard(\'history\')">📜 报修记录</button>'+
   '<button class="tab '+(_tab==='orders'?'active':'')+'" onclick="showDashboard(\'orders\')">📦 订单中心</button>'+
   '<button class="tab '+(_tab==='profile'?'active':'')+'" onclick="showDashboard(\'profile\')">⚙️ 我的信息</button>'+
   '</div><div id="tabBody"></div>';

  if(_tab==='repair')repairForm();
  else if(_tab==='selfhelp')selfHelpPage();
  else if(_tab==='parts')partsShop(parts);
  else if(_tab==='history')historyList(tasks);
  else if(_tab==='orders')orderList(orders);
  else if(_tab==='profile')profileForm();
 });
}

// ====== 我的信息 ======
function profileForm(){
 var i=sess.info||{};
 loadRegions(function(regions){
  var provs=regions&&regions.data?regions.data:['广东省'];
  var psel='';for(var k=0;k<provs.length;k++)psel+='<option value="'+provs[k]+'"'+(provs[k]===(i.province||'广东省')?' selected':'')+'>'+provs[k]+'</option>';
  document.getElementById('tabBody').innerHTML='<div class="card"><h3 style="font-size:15px;margin-bottom:10px">📝 企业信息</h3><form onsubmit="return saveProfile(event)"><div class="fr"><div class="fg"><label>手机号</label><div style="padding:9px 11px;background:#f8fafc;border-radius:8px;border:1px solid var(--b);font-size:13px">'+esc(sess.phone)+'</div></div><div class="fg"><label>工厂名称 *</label><input type="text" id="pfFn" value="'+esc(i.factoryName||'')+'" placeholder="请输入工厂或公司名称" required></div></div><div class="fr3"><div class="fg"><label>省份</label><select id="pfProv" onchange="pfUpdateCities()">'+psel+'</select></div><div class="fg"><label>城市</label><select id="pfCity" onchange="pfUpdateDistricts()"><option>请选择</option></select></div><div class="fg"><label>区/县</label><select id="pfDist"><option>请选择</option></select></div></div><div class="fg"><label>详细地址 *</label><input type="text" id="pfAd" value="'+esc(i.detailAddress||i.address||'')+'" placeholder="街道名称、门牌号等" required></div><button class="btn btn-p btn-block">💾 保存信息</button></form></div>';
  pfUpdateCities(function(){pfUpdateDistricts();});
 });
}
function pfUpdateCities(cb){
 var p=document.getElementById('pfProv').value;
 loadCities(p,function(cities){
  fillSelect('pfCity',cities.length?cities:['其他'],sess.info&&sess.info.city||'');
  if(cb)cb();
 });
}
function pfUpdateDistricts(){
 var p=document.getElementById('pfProv').value,c=document.getElementById('pfCity').value;
 loadDistricts(p,c,function(districts){fillSelect('pfDist',districts.length?districts:['其他'],sess.info&&sess.info.district||'');});
}
function saveProfile(e){e.preventDefault();var fn=document.getElementById('pfFn').value.trim(),prov=document.getElementById('pfProv').value,city=document.getElementById('pfCity').value,dist=document.getElementById('pfDist').value,ad=document.getElementById('pfAd').value.trim();if(!fn||!ad){toast('请填写工厂名称和详细地址','e');return false;}api('/api/customer/info','PUT',{phone:sess.phone,factoryName:fn,province:prov,city:city,district:dist,detailAddress:ad,address:prov+' '+city+' '+dist+' '+ad}).then(function(r){if(r.ok){sess.info=r.data;save();toast('信息已保存','s');showDashboard('profile');}});return false;}

// ====== 自助查询 ======
var _shMach='',_shComp='';
function selfHelpPage(){
 var machOpts='<option value="">请选择设备类型</option>';
 ['光纤激光切割机','门友软件'].forEach(function(m){machOpts+='<option value="'+m+'"'+(_shMach===m?' selected':'')+'>'+m+'</option>';});
 var compData={
  '光纤激光切割机':['激光器（创鑫/锐科/IPG）','切割头（普雷斯特/万顺兴）','伺服电机（松下/安川/台达）','伺服控制器','柏楚切割系统','低压控制电路','电气线路/控制线路','冷却系统（水冷机）','气路系统（辅助气体）','光路系统（镜片/光纤）','床身/工作台','其他'],
  '门友软件':['软件安装/激活','数据对接问题','报表/打印问题','操作培训','软件升级/更新','系统兼容性','其他']
 };
 var compOpts='<option value="">请先选择设备类型</option>';
 if(_shMach&&compData[_shMach]){compData[_shMach].forEach(function(c){compOpts+='<option value="'+c+'"'+(_shComp===c?' selected':'')+'>'+c+'</option>';});}
 var links='';
 if(_shMach==='光纤激光切割机'){
  links='<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:8px;font-size:11px">'+
   '<strong>🔗 外部资源链接：</strong><br>'+
   '<a href="https://www.maxphotonics.com/" target="_blank" style="color:var(--p);margin-right:10px">🔗 创鑫激光官网</a>'+
   '<a href="https://www.zaoshu.so/search?keyword=光纤激光切割机维修" target="_blank" style="color:var(--p);margin-right:10px">🔍 抖音搜索维修教程</a>'+
   '<a href="https://www.baidu.com/s?wd=光纤激光切割机+维修" target="_blank" style="color:var(--p);margin-right:10px">🌐 百度搜索</a>'+
   '<a href="http://www.bc-sys.com/" target="_blank" style="color:var(--p)">🔗 柏楚电子官网</a>'+
   '</div>';
 }else if(_shMach==='门友软件'){
  links='<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:8px;font-size:11px">'+
   '<strong>🔗 外部资源链接：</strong><br>'+
   '<a href="https://www.baidu.com/s?wd=门友软件+常见问题" target="_blank" style="color:var(--p);margin-right:10px">🌐 百度搜索门友软件</a>'+
   '<a href="https://www.zaoshu.so/search?keyword=门友软件教程" target="_blank" style="color:var(--p)">🔍 抖音搜索教程</a>'+
   '</div>';
 }
 document.getElementById('tabBody').innerHTML=
  '<div class="card"><h3 style="font-size:15px;margin-bottom:6px">🔍 自助故障查询</h3><p style="color:var(--ts);font-size:11px;margin-bottom:12px">选择设备类型和故障部位，AI将为您提供排查方案（使用豆包AI模型）</p>'+
  '<div class="fr"><div class="fg"><label>设备类型</label><select id="shMach" onchange="_shMach=this.value;_shComp=\'\';selfHelpPage()">'+machOpts+'</select></div>'+
  '<div class="fg"><label>故障部位/组件</label><select id="shComp" onchange="_shComp=this.value">'+compOpts+'</select></div></div>'+
  '<div class="fg"><label>问题描述</label><textarea id="shQuery" rows="3" placeholder="请描述您遇到的问题现象...例如：激光器不亮、切割有毛刺、软件无法打开等"></textarea></div>'+
  '<button class="btn btn-p btn-block" onclick="doAISearch()" id="shBtn">🤖 AI智能查询</button>'+
  links+
  '<div id="shResult" style="margin-top:12px"></div></div>';
}
function doAISearch(){
 var mach=document.getElementById('shMach').value,comp=document.getElementById('shComp').value,query=document.getElementById('shQuery').value.trim();
 if(!query){toast('请描述问题现象','e');return;}
 var btn=document.getElementById('shBtn');btn.disabled=true;btn.textContent='🤖 AI查询中，请稍候...';
 document.getElementById('shResult').innerHTML='<div class="emp">🤖 正在调用豆包AI模型查询，请稍候...</div>';
 api('/api/ai-search','POST',{machineType:mach,component:comp,query:query}).then(function(r){
  btn.disabled=false;btn.textContent='🤖 AI智能查询';
  if(r.ok&&r.data){
   document.getElementById('shResult').innerHTML=
    '<div class="card" style="border-left:3px solid var(--p);background:#fafbff"><div style="font-size:11px;color:var(--ts);margin-bottom:6px">🤖 豆包AI · 仅供参考</div>'+
    '<div style="white-space:pre-wrap;line-height:1.8;font-size:13px">'+esc(r.data.answer)+'</div>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--ts)">以上为AI建议，如问题仍未解决请提交报修工单</div>'+
    '<button class="btn btn-p btn-sm" style="margin-top:8px" onclick="showDashboard(\'repair\')">🔧 去报修</button></div>';
  }else{
   document.getElementById('shResult').innerHTML='<div class="card" style="border-left:3px solid var(--d)"><p style="color:var(--d);font-size:13px;margin-bottom:6px">❌ '+esc(r.msg||'查询失败')+'</p>'+(r.msg&&r.msg.indexOf('未配置')>=0?'<p style="font-size:11px;color:var(--ts)">请联系管理员在系统设置中配置豆包API密钥</p>':'<p style="font-size:11px;color:var(--ts)">请尝试使用外部资源链接搜索，或提交报修工单</p>')+'<button class="btn btn-p btn-sm" onclick="showDashboard(\'repair\')">🔧 去报修</button></div>';
  }
 }).catch(function(){
  btn.disabled=false;btn.textContent='🤖 AI智能查询';
  document.getElementById('shResult').innerHTML='<div class="card" style="border-left:3px solid var(--d)"><p style="color:var(--d)">❌ 网络连接失败，请稍后重试</p><button class="btn btn-p btn-sm" onclick="showDashboard(\'repair\')">🔧 去报修</button></div>';
 });
}
// ====== 设备报修 ======
function repairForm(){
 _photos=[];
 var i=sess.info||{};
 var mt='<option value="">请选择设备类型</option>';
 ['激光切割机','折弯机','翻边机','冲床','剪板机','开平机','压花机','门框成型机','门板成型机','焊接设备','喷涂设备','门友软件','其他设备'].forEach(function(m){mt+='<option>'+m+'</option>';});

 loadRegions(function(regions){
  var provs=regions&&regions.data?regions.data:['广东省'];
  var sprov=i.province||'广东省';
  var psel='';for(var k=0;k<provs.length;k++)psel+='<option value="'+provs[k]+'"'+(provs[k]===sprov?' selected':'')+'>'+provs[k]+'</option>';
  document.getElementById('tabBody').innerHTML='<div class="card"><h3 style="font-size:15px;margin-bottom:10px">🔧 提交设备报修</h3><form onsubmit="return submitRepair(event)"><div class="fr"><div class="fg"><label>工厂名称</label><input type="text" id="rFn" value="'+esc(i.factoryName||'')+'" placeholder="工厂或公司名称"></div><div class="fg"><label>设备类型 *</label><select id="rMt" required onchange="updateParts();autoFillDevice()">'+mt+'</select></div></div><div class="fg"><label>故障部位 *</label><select id="rPart" required><option value="">请先选择设备类型</option></select></div><div class="fg"><label>位置信息</label><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><button type="button" class="loc-btn" id="locBtn" onclick="locateGPS()">📍 定位当前位置</button><span id="locAddr" style="font-size:10px;color:var(--ts)"></span></div></div><div class="fr3"><div class="fg"><label>省份</label><select id="rProv" onchange="updateCities()">'+psel+'</select></div><div class="fg"><label>城市</label><select id="rCity" onchange="updateDistricts()"><option>请选择</option></select></div><div class="fg"><label>区/县</label><select id="rDist"><option>请选择</option></select></div></div><div class="fg"><label>详细地址 *</label><input type="text" id="rAd" value="'+esc(i.detailAddress||i.address||'')+'" placeholder="街道名称、门牌号等详细地址" required></div><div class="fr"><div class="fg"><label>出厂日期 *</label><input type="text" id="rMd" placeholder="按照铭牌填写 · 点击选择" required readonly class="date-trigger" onclick="openDatePicker(\'rMd\',\'date\')"></div><div class="fg"><label>期望处理时间</label><input type="text" id="rEd" placeholder="点击选择期望时间" readonly class="date-trigger" onclick="openDatePicker(\'rEd\',\'datetime\')"></div></div><div class="fg"><label>设备编号</label><input type="text" id="rSn" placeholder="按照铭牌填写"></div><div class="fg"><label>故障描述 *</label><textarea id="rFd" placeholder="请详细描述设备故障现象...（如含"激光器"故障，保修期将延长至2年）" required></textarea></div><div class="fg"><label>现场照片 <small style="color:var(--ts)">最多5张</small></label><div class="pu" id="photoArea" onclick="document.getElementById(\'photoIn\').click()"><div id="photoHint">📷 点击拍照或选择照片</div><div class="pv" id="photoPrevs"></div></div><input type="file" id="photoIn" accept="image/*" multiple style="display:none" onchange="handlePhoto(event)" capture="environment"></div><button class="btn btn-p btn-block btn-lg">🚀 提交报修申请</button></form></div>';
  updateCities(function(){updateDistricts();});
 });
}

function autoFillDevice(){var mt=document.getElementById('rMt').value;var sn=document.getElementById('rSn');if(mt==='门友软件'&&sn)sn.value='门友本地版';}
function updateParts(){
 var mt=document.getElementById('rMt').value;
 if(!mt){document.getElementById('rPart').innerHTML='<option value="">请先选择设备类型</option>';return;}
 loadEquipParts(mt,function(parts){
  var sel=document.getElementById('rPart'),html='<option value="">请选择故障部位</option>';
  for(var i=0;i<parts.length;i++)html+='<option>'+parts[i]+'</option>';
  sel.innerHTML=html;
 });
}
function updateCities(cb){
 var p=document.getElementById('rProv').value;
 loadCities(p,function(cities){
  fillSelect('rCity',cities.length?cities:['其他'],sess.info&&sess.info.city||'');
  if(cb)cb();
 });
}
function updateDistricts(){
 var p=document.getElementById('rProv').value,c=document.getElementById('rCity').value;
 loadDistricts(p,c,function(districts){fillSelect('rDist',districts.length?districts:['其他'],sess.info&&sess.info.district||'');});
}

function handlePhoto(e){addPhoto(Array.from(e.target.files));e.target.value='';}
function addPhoto(files){if(_photos.length>=5){toast('最多上传5张照片','e');return;}var r=5-_photos.length;files.slice(0,r).forEach(function(f){if(!f.type.match(/^image\//))return;var rd=new FileReader();rd.onload=function(ev){_photos.push(ev.target.result);renderPhotos();};rd.readAsDataURL(f);});}
function removePhoto(i){_photos.splice(i,1);renderPhotos();}
function renderPhotos(){var c=document.getElementById('photoPrevs'),h=document.getElementById('photoHint'),a=document.getElementById('photoArea');if(!c)return;if(_photos.length>0){h.style.display='none';a.classList.add('has');}else{h.style.display='';a.classList.remove('has');}c.innerHTML=_photos.map(function(p,i){return'<div class="pp"><img src="'+p+'"><button class="pr" onclick="event.stopPropagation();removePhoto('+i+')">×</button></div>';}).join('');}

function submitRepair(e){e.preventDefault();if(!sess.phone){toast('请先登录','e');return false;}
 var fn=document.getElementById('rFn').value.trim(),prov=document.getElementById('rProv').value,city=document.getElementById('rCity').value,dist=document.getElementById('rDist').value,ad=document.getElementById('rAd').value.trim();
 var mt=document.getElementById('rMt').value,mp=document.getElementById('rPart').value,md=document.getElementById('rMd').value,ed=document.getElementById('rEd').value,sn=document.getElementById('rSn').value.trim(),fd=document.getElementById('rFd').value.trim();
 if(!mt||!md||!fd||!mp){toast('请填写所有带 * 的必填项（包括故障部位）','e');return false;}
 if(!ad){toast('请填写详细地址','e');return false;}
 var fullAddr=prov+' '+city+' '+dist+' '+ad;
 api('/api/customer/info','PUT',{phone:sess.phone,factoryName:fn,province:prov,city:city,district:dist,detailAddress:ad,address:fullAddr});
 api('/api/tasks','POST',{customerPhone:sess.phone,customerName:sess.displayName,factoryName:fn,province:prov,city:city,district:dist,detailAddress:ad,address:fullAddr,machineType:mt,machinePart:mp,machineSn:sn,manufactureDate:md?new Date(md).getTime():null,expectedDate:ed?new Date(ed).getTime():null,faultDescription:fd,photos:_photos.slice()}).then(function(r){
  if(r.ok){_photos=[];toast('报修提交成功！工单编号：'+r.data.id,'s');showDashboard('history');}else toast(r.msg||'提交失败','e');
 });
 return false;
}

// ====== 报修记录 ======
function historyList(tasks){
 tasks.sort(function(a,b){return b.createdAt-a.createdAt;});
 var h='';
 if(tasks.length===0)h='<div class="emp">📭 暂无报修记录</div>';
 else{
  var sm={pending:'bg-yellow',processing:'bg-blue',completed:'bg-green',cancelled:'bg-red'},st={pending:'待处理',processing:'处理中',completed:'已完成',cancelled:'已取消'};
  for(var i=0;i<tasks.length;i++){var t=tasks[i];
   var warrantyTag='';if(t.warrantyStatus==='in_warranty')warrantyTag='<span class="badge bg-green" style="margin-left:4px">🛡️ 在保('+(t.warrantyMonths||12)+'月)</span>';else if(t.warrantyStatus==='out_warranty')warrantyTag='<span class="badge bg-red" style="margin-left:4px">⚠️ 过保</span>';
   var assignInfo='';
   if(t.assigneeName){assignInfo+='<div style="font-size:10px;color:var(--s);margin-top:1px">👤 '+esc(t.assigneeName);if(t.assigneePhone)assignInfo+=' 📞'+esc(t.assigneePhone);if(t.acceptTime)assignInfo+=' 🕐'+fmt(t.acceptTime);assignInfo+='</div>';}
   if(t.quotationStatus==='approved'&&t.quotation!==null)assignInfo+='<div style="font-size:10px;color:var(--d);margin-top:1px">💰 费用：¥'+(t.quotation||0)+'（已审批）</div>';
   h+='<div class="item" onclick="showTask(\''+t.id+'\')"><div class="info"><div class="title">🔧 '+esc(t.machineType)+' <small style="color:var(--tl)">#'+t.id+'</small>'+warrantyTag+(t.machinePart?'<span class="badge bg-cyan" style="margin-left:3px">'+esc(t.machinePart).slice(0,5)+'</span>':'')+'</div><div class="sub">'+fmt(t.createdAt)+(t.factoryName?' · '+esc(t.factoryName):'')+'</div>'+assignInfo+'</div><div><span class="badge '+(sm[t.status]||'bg-yellow')+'">'+(st[t.status]||'待处理')+'</span></div></div>';
 } }
 document.getElementById('tabBody').innerHTML='<div class="card"><div class="card-head"><h3>📜 报修记录 · '+tasks.length+' 条</h3></div>'+h+'</div>';
}

function showTask(id){api('/api/tasks?phone='+sess.phone).then(function(r){if(!r.ok)return;var t=null;for(var i=0;i<r.data.length;i++){if(r.data[i].id===id){t=r.data[i];break;}}if(!t)return;
 var st={pending:'待处理',processing:'处理中',completed:'已完成',cancelled:'已取消'},sm={pending:'bg-yellow',processing:'bg-blue',completed:'bg-green',cancelled:'bg-red'};
 var addr='';if(t.province)addr+=t.province;if(t.city)addr+=' '+t.city;if(t.district)addr+=' '+t.district;if(t.detailAddress)addr+=' '+t.detailAddress;if(!addr&&t.address)addr=t.address;
 var addrEnc=encodeURIComponent(addr||'广东省佛山市');
 var mapHtml='<div style="border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid var(--b)"><iframe width="100%" height="150" frameborder="0" scrolling="no" src="https://api.map.baidu.com/static/v2?ak=&center='+addrEnc+'&width=400&height=150&zoom=14&markers='+addrEnc+'"></iframe></div>';

 var progressHtml='<div style="padding:8px 0">';
 // 1. 已受理
 progressHtml+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><div style="width:28px;height:28px;border-radius:50%;background:var(--s);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0">✓</div><div><div style="font-weight:600;font-size:13px;color:var(--t)">服务需求已受理</div><div style="font-size:10px;color:var(--ts)">'+fmt(t.createdAt)+' · 您的报修已提交</div></div></div>';
 // 2. 已接单/已派工
 if(t.assigneeName){
  progressHtml+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><div style="width:28px;height:28px;border-radius:50%;background:var(--p);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0">✓</div><div><div style="font-weight:600;font-size:13px;color:var(--t)">已接单 · 已派工</div><div style="font-size:11px;color:var(--ts)">售后人员：<strong>'+esc(t.assigneeName)+'</strong></div>'+(t.assigneePhone?'<div style="font-size:11px;color:var(--ts)">电话：<a href="tel:'+esc(t.assigneePhone)+'" style="color:var(--p);font-weight:600;text-decoration:underline">'+esc(t.assigneePhone)+' 📞点击拨打</a></div>':'')+'<div style="font-size:10px;color:var(--ts)">接单时间：'+fmt(t.acceptTime||t.createdAt)+'</div><div style="font-size:10px;color:var(--w);margin-top:2px">⚠️ 即将为您服务，请注意来电。如紧急情况，请主动联系服务人员。</div></div></div>';
 }else if(t.status!=='cancelled'){
  progressHtml+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><div style="width:28px;height:28px;border-radius:50%;background:var(--b);display:flex;align-items:center;justify-content:center;color:var(--ts);font-size:14px;flex-shrink:0">⏳</div><div><div style="font-weight:600;font-size:13px;color:var(--ts)">等待接单</div><div style="font-size:10px;color:var(--ts)">售后人员即将接单处理</div></div></div>';
 }
 // 3. 维修中/已完成
 if(t.status==='completed'){
  progressHtml+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><div style="width:28px;height:28px;border-radius:50%;background:var(--s);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0">✓</div><div><div style="font-weight:600;font-size:13px;color:var(--t)">维修已完成</div><div style="font-size:10px;color:var(--ts)">'+(t.repairEndTime?fmt(t.repairEndTime):'')+'</div>'+(t.resolution?'<div style="font-size:11px;background:#f0fdf4;padding:6px 8px;border-radius:4px;margin-top:4px">📝 '+esc(t.resolution)+'</div>':'')+'</div></div>';
 }else if(t.status==='processing'){
  progressHtml+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><div style="width:28px;height:28px;border-radius:50%;background:var(--w);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0">🔧</div><div><div style="font-weight:600;font-size:13px;color:var(--t)">维修处理中</div><div style="font-size:10px;color:var(--ts)">售后人员正在处理您的设备</div></div></div>';
 }
 progressHtml+='</div>';

 var info='';
 info+='<div class="ic"><div class="il">工单编号</div><div class="iv">'+t.id+'</div></div>';
 info+='<div class="ic"><div class="il">报修人</div><div class="iv">'+esc(t.customerName||t.customerPhone)+'</div></div>';
 info+='<div class="ic"><div class="il">设备类型</div><div class="iv">'+esc(t.machineType)+'</div></div>';
 info+='<div class="ic"><div class="il">故障部位</div><div class="iv">'+(t.machinePart?esc(t.machinePart):'未指定')+'</div></div>';
 info+='<div class="ic"><div class="il">出厂日期</div><div class="iv">'+(t.manufactureDate?fmtD(t.manufactureDate):'-')+'</div></div>';
 info+='<div class="ic"><div class="il">状态</div><div class="iv"><span class="badge '+(sm[t.status]||'bg-yellow')+'">'+(st[t.status]||'待处理')+'</span></div></div>';
 if(t.quotation!==null&&t.quotation!==undefined)info+='<div class="ic full"><div class="il">💰 维修费用</div><div class="iv" style="color:var(--d);font-size:14px">¥'+(t.quotation||0)+' <span class="badge '+(t.quotationStatus==='approved'?'bg-green':(t.quotationStatus==='rejected'?'bg-red':'bg-purple'))+'">'+(t.quotationStatus==='approved'?'已审批':(t.quotationStatus==='rejected'?'已拒绝':'待审批'))+'</span></div></div>';
 document.getElementById('modal').innerHTML='<button class="close" onclick="closeModal()">×</button><h3 style="font-size:15px;margin-bottom:4px">📋 报修详情</h3><p style="color:var(--ts);font-size:11px;margin-bottom:10px">工单编号：'+t.id+'</p>'+mapHtml+'<div style="font-weight:700;font-size:13px;margin-bottom:6px">📌 服务进度</div>'+progressHtml+'<div class="ig" style="margin-top:8px">'+info+'</div><button class="btn btn-o btn-block" onclick="closeModal()">关闭</button>';
 document.getElementById('overlay').classList.add('show');
});}
function closeModal(){document.getElementById('overlay').classList.remove('show');}

// ====== 配件选购 ======
function partsShop(parts){var fl=_sf||'';var filtered=[];for(var i=0;i<parts.length;i++){if(!fl||parts[i].category===fl||parts[i].name.indexOf(fl)!==-1)filtered.push(parts[i]);}var cards='';for(var j=0;j<filtered.length;j++){var p=filtered[j];cards+='<div class="g-card">'+(p.image?'<img src="'+p.image+'" onerror="this.style.display=\'none\'">':'<div style="width:100%;height:85px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:6px">📦</div>')+'<div class="g-name">'+esc(p.name)+'</div><div class="g-price">¥'+p.price.toFixed(2)+' / '+esc(p.unit||'件')+'</div><div class="g-stock">库存：'+p.stock+'</div><button class="btn btn-p btn-xs btn-block" style="margin-top:4px" onclick="addCart(\''+p.id+'\')">加入购物车</button></div>';}var cats=[];for(var c=0;c<parts.length;c++){if(cats.indexOf(parts[c].category)===-1)cats.push(parts[c].category);}var co='<option value="">全部分类</option>';for(var k=0;k<cats.length;k++)co+='<option value="'+cats[k]+'">'+cats[k]+'</option>';document.getElementById('tabBody').innerHTML='<div class="card"><div class="card-head"><h3>🛒 配件选购</h3><div style="display:flex;gap:5px"><input type="text" placeholder="搜索配件..." style="padding:6px 9px;border:1.5px solid var(--b);border-radius:6px;width:110px;font-size:12px" oninput="_sf=this.value;showDashboard(\'parts\')"><select onchange="_sf=this.value;showDashboard(\'parts\')" style="padding:6px 9px;border:1.5px solid var(--b);border-radius:6px;font-size:12px">'+co+'</select></div></div><div class="grid">'+(cards||'<div class="emp">暂无匹配配件</div>')+'</div></div><div class="card" id="cartBox">'+buildCart()+'</div>';}
function addCart(pid){if(!sess.phone){toast('请先登录','e');return;}_cart[pid]=(_cart[pid]||0)+1;toast('已加入购物车','s');partsShop([]);}
function buildCart(){var ids=Object.keys(_cart).filter(function(k){return _cart[k]>0;});if(ids.length===0)return'<div class="card-head"><h3>🛒 购物车</h3></div><div class="emp" style="padding:16px">购物车是空的</div>';api('/api/parts').then(function(r){var parts=r.ok?r.data:[];var total=0,items='';ids.forEach(function(pid){var q=_cart[pid];var p=null;for(var j=0;j<parts.length;j++){if(parts[j].id===pid){p=parts[j];break;}}if(!p)return;total+=p.price*q;items+='<div class="cart-row"><div><strong>'+esc(p.name)+'</strong><div style="font-size:10px;color:var(--ts)">¥'+p.price.toFixed(2)+' × '+q+' = ¥'+(p.price*q).toFixed(2)+'</div></div><div style="display:flex;align-items:center;gap:3px"><button class="btn btn-o btn-xs" onclick="_cart[\''+pid+'\']--;buildCart()">−</button><span style="font-weight:600;min-width:16px;text-align:center">'+q+'</span><button class="btn btn-o btn-xs" onclick="_cart[\''+pid+'\']++;buildCart()">+</button></div></div>';});document.getElementById('cartBox').innerHTML='<div class="card-head"><h3>🛒 购物车 · '+ids.length+' 种</h3><button class="btn btn-d btn-xs" onclick="_cart={};buildCart()">清空</button></div>'+items+'<div class="cart-total">合计：¥'+total.toFixed(2)+'</div><button class="btn btn-s btn-block" style="margin-top:6px" onclick="doCheckout()">📝 提交订单</button>';});return'<div class="card-head"><h3>🛒 购物车</h3></div><div class="emp">加载中...</div>';}
function doCheckout(){if(!sess.phone){toast('请先登录','e');return;}var info=sess.info||{};if(!info.factoryName||!info.detailAddress){toast('请先完善企业信息','e');showDashboard('profile');return;}var ids=Object.keys(_cart).filter(function(k){return _cart[k]>0;});if(ids.length===0){toast('购物车为空','e');return;}api('/api/parts').then(function(r){var parts=r.ok?r.data:[];var items=[];ids.forEach(function(pid){var p=null;for(var j=0;j<parts.length;j++){if(parts[j].id===pid){p=parts[j];break;}}if(p)items.push({partId:pid,partName:p.name,unitPrice:p.price,qty:_cart[pid],subtotal:p.price*_cart[pid]});});api('/api/orders','POST',{customerPhone:sess.phone,customerName:sess.displayName,factoryName:info.factoryName||'',address:info.province+' '+info.city+' '+info.district+' '+info.detailAddress,items:items}).then(function(r2){if(r2.ok){_cart={};showPay(r2.data);}else toast(r2.msg||'下单失败','e');});});}
function showPay(order){var ih='';for(var i=0;i<order.items.length;i++)ih+='<div style="font-size:11px;padding:2px 0">'+esc(order.items[i].partName)+' × '+order.items[i].qty+' = ¥'+order.items[i].subtotal.toFixed(2)+'</div>';api('/api/settings').then(function(r){var qr=(r.ok&&r.data&&r.data.paymentQR)?r.data.paymentQR:'';var qrHtml='';if(qr&&qr.startsWith('http')){qrHtml='<div style="margin:10px 0"><img src="'+qr+'" style="max-width:200px;border-radius:8px;border:2px solid var(--b)" onerror="this.style.display=\'none\'"><p style="font-size:10px;color:var(--ts)">请扫码支付</p></div>';}else if(qr&&qr.startsWith('#')){qrHtml='<div style="margin:10px 0;padding:10px;background:#fffbeb;border-radius:8px;font-size:11px;color:var(--w)">💡 '+esc(qr)+'</div>';}else{qrHtml='<div style="margin:10px 0"><img src="/WeChatpay.png" style="max-width:200px;border-radius:8px;border:2px solid var(--b)" onerror="this.style.display=\'none\'"><p style="font-size:10px;color:var(--ts)">请扫码支付</p></div>';}document.getElementById('modal').innerHTML='<button class="close" onclick="closeModal()">×</button><div class="pay-modal"><h3>💳 确认支付</h3><p style="color:var(--ts);margin:5px 0">订单编号：<strong>#'+order.id+'</strong></p>'+ih+'<div class="amt">¥ '+order.total.toFixed(2)+'</div>'+qrHtml+'<div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-s btn-block" style="flex:1;font-size:14px;padding:12px" onclick="confirmPay(\''+order.id+'\')">✅ 我已付款</button><button class="btn btn-o" style="flex:1" onclick="closeModal()">稍后再说</button></div></div>';document.getElementById('overlay').classList.add('show');});}
function confirmPay(oid,isReceive){isReceive=isReceive||false;var st=isReceive?'received':'paid';var msg=isReceive?'已确认收货':'付款成功，等待发货';api('/api/orders/'+oid+'/status','PUT',{status:st}).then(function(r){if(r.ok){closeModal();toast(msg,'s');showDashboard('orders');}else toast(r.msg||'操作失败','e');});}

// ====== 订单中心 ======
function orderList(orders){orders.sort(function(a,b){return b.createdAt-a.createdAt;});var h='';if(orders.length===0)h='<div class="emp">📭 暂无订单</div>';else{for(var j=0;j<orders.length;j++){var o=orders[j],stT,stC;if(o.status==='pending_payment'){stT='待付款';stC='bg-red';}else if(o.status==='paid'){stT='已付款';stC='bg-blue';}else if(o.status==='shipped'){stT='已发货';stC='bg-green';}else if(o.status==='received'){stT='已签收';stC='bg-green';}else{stT='其他';stC='bg-yellow';}var ih='';for(var k=0;k<o.items.length;k++)ih+='<div style="font-size:11px;padding:1px 0">'+esc(o.items[k].partName)+' × '+o.items[k].qty+' = ¥'+o.items[k].subtotal.toFixed(2)+'</div>';var tl='<div style="display:flex;align-items:center;gap:6px;font-size:10px;margin-top:4px;flex-wrap:wrap">';tl+='<span style="color:var(--s)">📝 下单</span><span style="color:var(--ts)">'+fmt(o.createdAt)+'</span>';if(o.paidAt)tl+='<span style="margin-left:6px;color:var(--p)">→ 💳 已付款</span><span style="color:var(--ts)">'+fmt(o.paidAt)+'</span>';if(o.shippedAt)tl+='<span style="margin-left:6px;color:#7c3aed">→ 📦 已发货</span><span style="color:var(--ts)">'+fmt(o.shippedAt)+'</span>';tl+='</div>';var payBtn=(o.status==='pending_payment')?'<div style="text-align:right;margin-top:4px"><button class="btn btn-s btn-xs" onclick="event.stopPropagation();repay(\''+o.id+'\')">💳 去付款</button></div>':'';if(o.status==='paid')payBtn='<div style="text-align:right;margin-top:4px"><button class="btn btn-p btn-xs" onclick="event.stopPropagation();confirmPay(\''+o.id+'\')">📦 确认收货</button></div>';h+='<div class="oc" onclick="showOrderDetail(\''+o.id+'\')"><div class="oc-head"><strong>#'+o.id+'</strong><span class="badge '+stC+'">'+stT+'</span></div>'+ih+'<div style="text-align:right;font-weight:700;font-size:14px;margin-top:3px">合计：¥'+o.total.toFixed(2)+'</div>'+tl+payBtn+'</div>';}}document.getElementById('tabBody').innerHTML='<div class="card"><div class="card-head"><h3>📦 订单中心 · '+orders.length+' 条</h3></div>'+h+'</div>';}
function showOrderDetail(oid){
 api('/api/orders?phone='+sess.phone).then(function(r){
  if(!r.ok)return;var o=null;for(var i=0;i<r.data.length;i++){if(r.data[i].id===oid){o=r.data[i];break;}}if(!o)return;
  var items='';for(var j=0;j<o.items.length;j++)items+='<tr><td>'+esc(o.items[j].partName)+'</td><td>¥'+o.items[j].unitPrice.toFixed(2)+'</td><td>'+o.items[j].qty+'</td><td>¥'+o.items[j].subtotal.toFixed(2)+'</td></tr>';
  var stT,stC;if(o.status==='pending_payment'){stT='待付款';stC='bg-red';}else if(o.status==='paid'){stT='已付款';stC='bg-blue';}else if(o.status==='shipped'){stT='已发货';stC='bg-green';}else if(o.status==='received'){stT='已签收';stC='bg-green';}else{stT='其它';stC='bg-yellow';}
  var tl='<div style="padding:10px 0">';
  tl+='<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><span style="color:var(--s);font-size:18px">●</span><div><div style="font-weight:600;font-size:12px">订单已提交</div><div style="font-size:10px;color:var(--ts)">'+fmt(o.createdAt)+'</div></div></div>';
  if(o.paidAt)tl+='<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><span style="color:var(--p);font-size:18px">●</span><div><div style="font-weight:600;font-size:12px">已付款</div><div style="font-size:10px;color:var(--ts)">'+fmt(o.paidAt)+'</div></div></div>';
  if(o.shippedAt)tl+='<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><span style="color:#7c3aed;font-size:18px">●</span><div><div style="font-weight:600;font-size:12px">已发货'+(o.outboundBy?' · 操作人：'+esc(o.outboundBy):'')+'</div><div style="font-size:10px;color:var(--ts)">'+fmt(o.shippedAt)+'</div></div></div>';
  if(o.relatedTaskId)tl+='<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><span style="color:var(--w);font-size:18px">●</span><div><div style="font-weight:600;font-size:12px">关联报修工单</div><div style="font-size:10px;color:var(--ts)">#'+esc(o.relatedTaskId)+'</div></div></div>';
  tl+='</div>';
  document.getElementById('modal').innerHTML='<button class="close" onclick="closeModal()">×</button><h3>📦 订单详情 #'+oid+'</h3><div style="margin:8px 0"><span class="badge '+stC+'">'+stT+'</span></div><div class="ig"><div class="ic"><div class="il">下单时间</div><div class="iv">'+fmt(o.createdAt)+'</div></div><div class="ic"><div class="il">合计金额</div><div class="iv" style="color:var(--d)">¥'+o.total.toFixed(2)+'</div></div></div><table style="margin-bottom:8px"><thead><tr><th>配件</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>'+items+'</tbody></table>'+tl+(o.status==='pending_payment'?'<button class="btn btn-s btn-block" onclick="closeModal();repay(\''+oid+'\')">💳 去付款</button>':'')+(o.status==='paid'?'<button class="btn btn-p btn-block" onclick="confirmPay(\''+oid+'\');closeModal()">📦 确认收货</button>':'')+'<button class="btn btn-o btn-block" style="margin-top:4px" onclick="closeModal()">关闭</button>';
  document.getElementById('overlay').classList.add('show');
 });
}
function repay(oid){api('/api/orders?phone='+sess.phone).then(function(r){if(r.ok){var o=null;for(var i=0;i<r.data.length;i++){if(r.data[i].id===oid){o=r.data[i];break;}}if(o)showPay(o);}});}

// Events
document.addEventListener('dragover',function(e){var a=document.getElementById('photoArea');if(a&&a.contains(e.target))e.preventDefault();});
document.addEventListener('drop',function(e){var a=document.getElementById('photoArea');if(a&&a.contains(e.target)){e.preventDefault();addPhoto(Array.from(e.dataTransfer.files));}});
document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});

load();showDashboard('repair');
