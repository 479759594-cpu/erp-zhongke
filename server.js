var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var crypto = require('crypto');

var PORT = 8080;
var DATA_FILE = path.join(__dirname, 'data.json');
var AUDIT_FILE = path.join(__dirname, 'audit.json');
var UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 验证码存储 (phone -> {code,expires,used})
var VCodes = {};

// ==================== 密码哈希 ====================
function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  // 如果是旧版明文密码（不含冒号），直接比对并自动升级
  if (stored.indexOf(':') === -1) return password === stored;
  var parts = stored.split(':');
  var salt = parts[0];
  var hash = parts.slice(1).join(':');
  var verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

// 数据加载时自动迁移明文密码
function migratePasswords(d) {
  var migrated = false;
  for (var i = 0; i < d.adminUsers.length; i++) {
    var u = d.adminUsers[i];
    if (u.password && u.password.indexOf(':') === -1) {
      u.password = hashPassword(u.password);
      migrated = true;
    }
  }
  return migrated;
}

// ==================== 完整的中国省市区数据 ====================
var REGIONS = {
  '北京市': { cities: { '北京市': ['东城区','西城区','朝阳区','丰台区','石景山区','海淀区','门头沟区','房山区','通州区','顺义区','昌平区','大兴区','怀柔区','平谷区','密云区','延庆区'] } },
  '天津市': { cities: { '天津市': ['和平区','河东区','河西区','南开区','河北区','红桥区','东丽区','西青区','津南区','北辰区','武清区','宝坻区','滨海新区','宁河区','静海区','蓟州区'] } },
  '上海市': { cities: { '上海市': ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'] } },
  '重庆市': { cities: { '重庆市': ['万州区','涪陵区','渝中区','大渡口区','江北区','沙坪坝区','九龙坡区','南岸区','北碚区','綦江区','大足区','渝北区','巴南区','黔江区','长寿区','江津区','合川区','永川区','南川区','璧山区','铜梁区','潼南区','荣昌区','开州区','梁平区','武隆区'] } },
  '河北省': { cities: { '石家庄市':['长安区','桥西区','新华区','井陉矿区','裕华区','藁城区','鹿泉区','栾城区'],'唐山市':['路南区','路北区','古冶区','开平区','丰南区','丰润区','曹妃甸区'],'秦皇岛市':['海港区','山海关区','北戴河区','抚宁区'],'邯郸市':['邯山区','丛台区','复兴区','峰峰矿区'],'保定市':['竞秀区','莲池区','满城区','清苑区','徐水区'],'廊坊市':['安次区','广阳区'],'沧州市':['新华区','运河区'],'衡水市':['桃城区','冀州区'],'邢台市':['襄都区','信都区'],'张家口市':['桥东区','桥西区','宣化区','下花园区','万全区','崇礼区'],'承德市':['双桥区','双滦区','鹰手营子矿区'] } },
  '山西省': { cities: { '太原市':['小店区','迎泽区','杏花岭区','尖草坪区','万柏林区','晋源区'],'大同市':['平城区','云冈区','新荣区','云州区'],'阳泉市':['城区','矿区','郊区'],'长治市':['潞州区','上党区','屯留区','潞城区'],'晋城市':['城区'],'朔州市':['朔城区','平鲁区'],'晋中市':['榆次区','太谷区'],'运城市':['盐湖区'],'临汾市':['尧都区'],'吕梁市':['离石区'],'忻州市':['忻府区'] } },
  '内蒙古自治区': { cities: { '呼和浩特市':['新城区','回民区','玉泉区','赛罕区'],'包头市':['东河区','昆都仑区','青山区','石拐区','白云矿区','九原区'],'乌海市':['海勃湾区','海南区','乌达区'],'赤峰市':['红山区','元宝山区','松山区'],'通辽市':['科尔沁区'],'鄂尔多斯市':['东胜区','康巴什区'],'呼伦贝尔市':['海拉尔区','扎赉诺尔区'],'巴彦淖尔市':['临河区'],'乌兰察布市':['集宁区'] } },
  '辽宁省': { cities: { '沈阳市':['和平区','沈河区','大东区','皇姑区','铁西区','苏家屯区','浑南区','沈北新区','于洪区','辽中区'],'大连市':['中山区','西岗区','沙河口区','甘井子区','旅顺口区','金州区','普兰店区'],'鞍山市':['铁东区','铁西区','立山区','千山区'],'抚顺市':['新抚区','东洲区','望花区','顺城区'],'本溪市':['平山区','溪湖区','明山区','南芬区'],'丹东市':['元宝区','振兴区','振安区'],'锦州市':['古塔区','凌河区','太和区'],'营口市':['站前区','西市区','鲅鱼圈区','老边区'],'阜新市':['海州区','新邱区','太平区','清河门区','细河区'],'辽阳市':['白塔区','文圣区','宏伟区','弓长岭区','太子河区'],'盘锦市':['双台子区','兴隆台区','大洼区'],'铁岭市':['银州区','清河区'],'朝阳市':['双塔区','龙城区'],'葫芦岛市':['连山区','龙港区','南票区'] } },
  '吉林省': { cities: { '长春市':['南关区','宽城区','朝阳区','二道区','绿园区','双阳区','九台区'],'吉林市':['昌邑区','龙潭区','船营区','丰满区'],'四平市':['铁西区','铁东区'],'辽源市':['龙山区','西安区'],'通化市':['东昌区','二道江区'],'白山市':['浑江区','江源区'],'松原市':['宁江区'],'白城市':['洮北区'] } },
  '黑龙江省': { cities: { '哈尔滨市':['道里区','南岗区','道外区','平房区','松北区','香坊区','呼兰区','阿城区','双城区'],'齐齐哈尔市':['龙沙区','建华区','铁锋区','昂昂溪区','富拉尔基区','碾子山区','梅里斯区'],'鸡西市':['鸡冠区','恒山区','滴道区','梨树区','城子河区','麻山区'],'鹤岗市':['向阳区','工农区','南山区','兴安区','东山区','兴山区'],'双鸭山市':['尖山区','岭东区','四方台区','宝山区'],'大庆市':['萨尔图区','龙凤区','让胡路区','红岗区','大同区'],'佳木斯市':['向阳区','前进区','东风区','郊区'],'牡丹江市':['东安区','阳明区','爱民区','西安区'],'绥化市':['北林区'] } },
  '江苏省': { cities: { '南京市':['玄武区','秦淮区','建邺区','鼓楼区','浦口区','栖霞区','雨花台区','江宁区','六合区','溧水区','高淳区'],'无锡市':['锡山区','惠山区','滨湖区','梁溪区','新吴区','江阴市','宜兴市'],'徐州市':['鼓楼区','云龙区','贾汪区','泉山区','铜山区'],'常州市':['天宁区','钟楼区','新北区','武进区','金坛区'],'苏州市':['姑苏区','虎丘区','吴中区','相城区','吴江区'],'南通市':['崇川区','通州区','海门区'],'连云港市':['连云区','海州区','赣榆区'],'淮安市':['淮安区','淮阴区','清江浦区','洪泽区'],'盐城市':['亭湖区','盐都区','大丰区'],'扬州市':['广陵区','邗江区','江都区'],'镇江市':['京口区','润州区','丹徒区'],'泰州市':['海陵区','高港区','姜堰区'],'宿迁市':['宿城区','宿豫区'] } },
  '浙江省': { cities: { '杭州市':['上城区','拱墅区','西湖区','滨江区','萧山区','余杭区','富阳区','临安区','临平区','钱塘区'],'宁波市':['海曙区','江北区','北仑区','镇海区','鄞州区','奉化区'],'温州市':['鹿城区','龙湾区','瓯海区','洞头区'],'嘉兴市':['南湖区','秀洲区'],'湖州市':['吴兴区','南浔区'],'绍兴市':['越城区','柯桥区','上虞区'],'金华市':['婺城区','金东区'],'衢州市':['柯城区','衢江区'],'台州市':['椒江区','黄岩区','路桥区'],'丽水市':['莲都区'],'舟山市':['定海区','普陀区'] } },
  '安徽省': { cities: { '合肥市':['瑶海区','庐阳区','蜀山区','包河区'],'芜湖市':['镜湖区','鸠江区','弋江区','湾沚区','繁昌区'],'蚌埠市':['龙子湖区','蚌山区','禹会区','淮上区'],'马鞍山市':['花山区','雨山区','博望区'],'安庆市':['迎江区','大观区','宜秀区'],'阜阳市':['颍州区','颍东区','颍泉区'],'宿州市':['埇桥区'],'滁州市':['琅琊区','南谯区'],'六安市':['金安区','裕安区','叶集区'],'亳州市':['谯城区'],'池州市':['贵池区'],'宣城市':['宣州区'],'铜陵市':['铜官区','义安区','郊区'],'黄山市':['屯溪区','黄山区','徽州区'],'淮南市':['大通区','田家庵区','谢家集区','八公山区','潘集区'],'淮北市':['杜集区','相山区','烈山区'] } },
  '福建省': { cities: { '福州市':['鼓楼区','台江区','仓山区','马尾区','晋安区','长乐区'],'厦门市':['思明区','海沧区','湖里区','集美区','同安区','翔安区'],'莆田市':['城厢区','涵江区','荔城区','秀屿区'],'泉州市':['鲤城区','丰泽区','洛江区','泉港区'],'漳州市':['芗城区','龙文区','龙海区','长泰区'],'龙岩市':['新罗区','永定区'],'三明市':['三元区','沙县区'],'南平市':['延平区','建阳区'],'宁德市':['蕉城区'] } },
  '江西省': { cities: { '南昌市':['东湖区','西湖区','青云谱区','青山湖区','新建区','红谷滩区'],'景德镇市':['昌江区','珠山区'],'九江市':['濂溪区','浔阳区','柴桑区'],'赣州市':['章贡区','南康区','赣县区'],'上饶市':['信州区','广丰区','广信区'],'宜春市':['袁州区'],'吉安市':['吉州区','青原区'],'抚州市':['临川区','东乡区'],'萍乡市':['安源区','湘东区'],'新余市':['渝水区'],'鹰潭市':['月湖区','余江区'] } },
  '山东省': { cities: { '济南市':['历下区','市中区','槐荫区','天桥区','历城区','长清区','章丘区','济阳区','莱芜区','钢城区'],'青岛市':['市南区','市北区','黄岛区','崂山区','李沧区','城阳区','即墨区'],'淄博市':['淄川区','张店区','博山区','临淄区','周村区'],'枣庄市':['市中区','薛城区','峄城区','台儿庄区','山亭区'],'东营市':['东营区','河口区','垦利区'],'烟台市':['芝罘区','福山区','牟平区','莱山区','蓬莱区'],'潍坊市':['潍城区','寒亭区','坊子区','奎文区'],'济宁市':['任城区','兖州区'],'泰安市':['泰山区','岱岳区'],'威海市':['环翠区','文登区'],'日照市':['东港区','岚山区'],'临沂市':['兰山区','罗庄区','河东区'],'德州市':['德城区','陵城区'],'聊城市':['东昌府区','茌平区'],'滨州市':['滨城区','沾化区'],'菏泽市':['牡丹区','定陶区'] } },
  '河南省': { cities: { '郑州市':['中原区','二七区','管城回族区','金水区','上街区','惠济区'],'洛阳市':['老城区','西工区','瀍河区','涧西区','偃师区','孟津区'],'开封市':['龙亭区','顺河回族区','鼓楼区','禹王台区','祥符区'],'平顶山市':['新华区','卫东区','石龙区','湛河区'],'安阳市':['文峰区','北关区','殷都区','龙安区'],'新乡市':['红旗区','卫滨区','凤泉区','牧野区'],'焦作市':['解放区','中站区','马村区','山阳区'],'南阳市':['宛城区','卧龙区'],'商丘市':['梁园区','睢阳区'],'信阳市':['浉河区','平桥区'],'周口市':['川汇区','淮阳区'],'驻马店市':['驿城区'],'许昌市':['魏都区','建安区'],'漯河市':['源汇区','郾城区','召陵区'],'三门峡市':['湖滨区','陕州区'],'濮阳市':['华龙区'],'鹤壁市':['鹤山区','山城区','淇滨区'] } },
  '湖北省': { cities: { '武汉市':['江岸区','江汉区','硚口区','汉阳区','武昌区','青山区','洪山区','东西湖区','汉南区','蔡甸区','江夏区','黄陂区','新洲区'],'黄石市':['黄石港区','西塞山区','下陆区','铁山区'],'十堰市':['茅箭区','张湾区','郧阳区'],'宜昌市':['西陵区','伍家岗区','点军区','猇亭区','夷陵区'],'襄阳市':['襄城区','樊城区','襄州区'],'荆州市':['沙市区','荆州区'],'荆门市':['东宝区','掇刀区'],'孝感市':['孝南区'],'黄冈市':['黄州区'],'咸宁市':['咸安区'],'鄂州市':['梁子湖区','华容区','鄂城区'],'随州市':['曾都区'],'恩施土家族苗族自治州':['恩施市'] } },
  '湖南省': { cities: { '长沙市':['芙蓉区','天心区','岳麓区','开福区','雨花区','望城区'],'株洲市':['荷塘区','芦淞区','石峰区','天元区','渌口区'],'湘潭市':['雨湖区','岳塘区'],'衡阳市':['珠晖区','雁峰区','石鼓区','蒸湘区','南岳区'],'邵阳市':['双清区','大祥区','北塔区'],'岳阳市':['岳阳楼区','云溪区','君山区'],'常德市':['武陵区','鼎城区'],'张家界市':['永定区','武陵源区'],'益阳市':['资阳区','赫山区'],'郴州市':['北湖区','苏仙区'],'永州市':['零陵区','冷水滩区'],'怀化市':['鹤城区'],'娄底市':['娄星区'],'湘西土家族苗族自治州':['吉首市'] } },
  '广东省': { cities: { '广州市':['荔湾区','越秀区','海珠区','天河区','白云区','黄埔区','番禺区','花都区','南沙区','从化区','增城区'],'深圳市':['罗湖区','福田区','南山区','宝安区','龙岗区','盐田区','龙华区','坪山区','光明区'],'珠海市':['香洲区','斗门区','金湾区'],'汕头市':['龙湖区','金平区','濠江区','潮阳区','潮南区','澄海区'],'佛山市':['禅城区','南海区','顺德区','三水区','高明区'],'韶关市':['武江区','浈江区','曲江区'],'湛江市':['赤坎区','霞山区','坡头区','麻章区'],'肇庆市':['端州区','鼎湖区','高要区'],'江门市':['蓬江区','江海区','新会区'],'茂名市':['茂南区','电白区'],'惠州市':['惠城区','惠阳区'],'梅州市':['梅江区','梅县区'],'汕尾市':['城区'],'河源市':['源城区'],'阳江市':['江城区','阳东区'],'清远市':['清城区','清新区'],'东莞市':['东城街道','南城街道','万江街道','莞城街道'],'中山市':['石岐街道','东区街道','西区街道','南区街道','五桂山街道'],'潮州市':['湘桥区','潮安区'],'揭阳市':['榕城区','揭东区'],'云浮市':['云城区','云安区'] } },
  '广西壮族自治区': { cities: { '南宁市':['兴宁区','青秀区','江南区','西乡塘区','良庆区','邕宁区','武鸣区'],'柳州市':['城中区','鱼峰区','柳南区','柳北区','柳江区'],'桂林市':['秀峰区','叠彩区','象山区','七星区','雁山区','临桂区'],'梧州市':['万秀区','龙圩区','长洲区'],'北海市':['海城区','银海区','铁山港区'],'玉林市':['玉州区','福绵区'],'贵港市':['港北区','港南区','覃塘区'],'百色市':['右江区','田阳区'],'贺州市':['八步区','平桂区'],'河池市':['金城江区','宜州区'],'钦州市':['钦南区','钦北区'],'防城港市':['港口区','防城区'],'崇左市':['江州区'],'来宾市':['兴宾区'] } },
  '海南省': { cities: { '海口市':['秀英区','龙华区','琼山区','美兰区'],'三亚市':['海棠区','吉阳区','天涯区','崖州区'],'儋州市':['那大镇'] } },
  '四川省': { cities: { '成都市':['锦江区','青羊区','金牛区','武侯区','成华区','龙泉驿区','青白江区','新都区','温江区','双流区','郫都区','新津区'],'绵阳市':['涪城区','游仙区','安州区'],'自贡市':['自流井区','贡井区','大安区','沿滩区'],'攀枝花市':['东区','西区','仁和区'],'泸州市':['江阳区','纳溪区','龙马潭区'],'德阳市':['旌阳区','罗江区'],'广元市':['利州区','昭化区','朝天区'],'遂宁市':['船山区','安居区'],'内江市':['市中区','东兴区'],'乐山市':['市中区','沙湾区','五通桥区','金口河区'],'南充市':['顺庆区','高坪区','嘉陵区'],'宜宾市':['翠屏区','南溪区','叙州区'],'广安市':['广安区','前锋区'],'达州市':['通川区','达川区'],'眉山市':['东坡区','彭山区'],'雅安市':['雨城区','名山区'],'巴中市':['巴州区','恩阳区'],'资阳市':['雁江区'] } },
  '贵州省': { cities: { '贵阳市':['南明区','云岩区','花溪区','乌当区','白云区','观山湖区'],'遵义市':['红花岗区','汇川区','播州区'],'六盘水市':['钟山区','水城区'],'安顺市':['西秀区','平坝区'],'毕节市':['七星关区'],'铜仁市':['碧山区','万山区'] } },
  '云南省': { cities: { '昆明市':['五华区','盘龙区','官渡区','西山区','东川区','呈贡区','晋宁区'],'曲靖市':['麒麟区','沾益区','马龙区'],'玉溪市':['红塔区','江川区'],'保山市':['隆阳区'],'昭通市':['昭阳区'],'丽江市':['古城区'],'普洱市':['思茅区'],'临沧市':['临翔区'],'大理白族自治州':['大理市'],'楚雄彝族自治州':['楚雄市'],'红河哈尼族彝族自治州':['蒙自市'],'西双版纳傣族自治州':['景洪市'] } },
  '西藏自治区': { cities: { '拉萨市':['城关区','堆龙德庆区','达孜区'],'日喀则市':['桑珠孜区'],'昌都市':['卡若区'],'林芝市':['巴宜区'],'山南市':['乃东区'],'那曲市':['色尼区'] } },
  '陕西省': { cities: { '西安市':['新城区','碑林区','莲湖区','灞桥区','未央区','雁塔区','阎良区','临潼区','长安区','高陵区','鄠邑区'],'宝鸡市':['渭滨区','金台区','陈仓区','凤翔区'],'咸阳市':['秦都区','杨陵区','渭城区'],'铜川市':['王益区','印台区','耀州区'],'渭南市':['临渭区','华州区'],'延安市':['宝塔区','安塞区'],'汉中市':['汉台区','南郑区'],'榆林市':['榆阳区','横山区'],'安康市':['汉滨区'],'商洛市':['商州区'] } },
  '甘肃省': { cities: { '兰州市':['城关区','七里河区','西固区','安宁区','红古区'],'嘉峪关市':['雄关街道'],'金昌市':['金川区'],'白银市':['白银区','平川区'],'天水市':['秦州区','麦积区'],'武威市':['凉州区'],'张掖市':['甘州区'],'平凉市':['崆峒区'],'酒泉市':['肃州区'],'庆阳市':['西峰区'],'定西市':['安定区'],'陇南市':['武都区'] } },
  '青海省': { cities: { '西宁市':['城东区','城中区','城西区','城北区','湟中区'],'海东市':['乐都区','平安区'] } },
  '宁夏回族自治区': { cities: { '银川市':['兴庆区','西夏区','金凤区','灵武市'],'石嘴山市':['大武口区','惠农区'],'吴忠市':['利通区','红寺堡区'],'固原市':['原州区'],'中卫市':['沙坡头区'] } },
  '新疆维吾尔自治区': { cities: { '乌鲁木齐市':['天山区','沙依巴克区','新市区','水磨沟区','头屯河区','达坂城区','米东区'],'克拉玛依市':['独山子区','克拉玛依区','白碱滩区','乌尔禾区'],'吐鲁番市':['高昌区'],'哈密市':['伊州区'],'阿克苏地区':['阿克苏市'],'喀什地区':['喀什市'],'巴音郭楞蒙古自治州':['库尔勒市'],'昌吉回族自治州':['昌吉市'],'伊犁哈萨克自治州':['伊宁市'],'石河子市':['红山街道'] } },
  '香港特别行政区': { cities: { '香港岛':['中西区','湾仔区','东区','南区'],'九龙':['油尖旺区','深水埗区','九龙城区','黄大仙区','观塘区'],'新界':['葵青区','荃湾区','屯门区','元朗区','北区','大埔区','沙田区','西贡区','离岛区'] } },
  '澳门特别行政区': { cities: { '澳门半岛':['花地玛堂区','圣安多尼堂区','大堂区','望德堂区','风顺堂区'],'氹仔':['嘉模堂区'],'路环':['圣方济各堂区'] } },
  '台湾省': { cities: { '台北市':['中正区','大同区','中山区','松山区','大安区','万华区','信义区','士林区','北投区','内湖区','南港区','文山区'],'新北市':['板桥区','新庄区','中和区','永和区','土城区','树林区','三峡区','莺歌区','三重区','芦洲区','五股区','泰山区','林口区','淡水区','汐止区'] } }
};

var EQUIPMENT_PARTS = {
  '激光切割机': ['激光器','切割头','运动系统（X/Y/Z轴）','控制系统（CNC/PLC）','冷却系统（水冷机）','气路系统（辅助气体）','光路系统（镜片/光纤）','伺服电机/驱动器','床身/工作台','电气线路','软件/编程问题','其他'],
  '折弯机': ['液压系统','油缸/密封件','模具（上模/下模）','控制系统','后挡料系统','传动系统','电气线路','滑块/导轨','工作台','其他'],
  '翻边机': ['液压系统','翻边模具','传动系统','控制系统','气缸/管路','机架/导轨','其他'],
  '冲床': ['冲头/模具','传动系统（曲轴/连杆）','离合器/制动器','控制系统','送料机构','润滑系统','电气线路','其他'],
  '剪板机': ['刀片（上刀/下刀）','液压系统','后挡料系统','控制系统','传动系统','工作台','其他'],
  '开平机': ['矫直辊','送料辊','传动系统','控制系统','液压系统','剪切机构','其他'],
  '压花机': ['压花模具','液压系统','传动系统','控制系统','加热系统','其他'],
  '门框成型机': ['成型模具','传动系统','控制系统','切断机构','送料机构','液压系统','其他'],
  '门板成型机': ['成型模具','传动系统','控制系统','液压系统','送料机构','其他'],
  '焊接设备': ['焊枪/焊头','送丝机构','电源系统','控制系统','气路系统','冷却系统','其他'],
  '喷涂设备': ['喷枪/喷头','供粉/供漆系统','回收系统','加热/固化系统','传动系统','控制系统','其他'],
  '门友软件': ['软件安装/激活','数据对接','报表问题','操作培训','升级更新','其他'],
  '其他设备': ['机械部件','电气部件','控制系统','传动系统','液压/气动','其他']
};

function loadData() {
  try { if (fs.existsSync(DATA_FILE)) {
    var raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw || raw.trim().length === 0) throw new Error("数据文件为空");
    var d = JSON.parse(raw);
    if (migratePasswords(d)) saveData(d);
    return d;
  } } catch(e) {
    console.error("[错误] 加载数据失败:", e.message);
    // 尝试从备份恢复
    var bak = DATA_FILE + ".bak";
    if (fs.existsSync(bak)) {
      try {
        var bakRaw = fs.readFileSync(bak, "utf8");
        if (bakRaw && bakRaw.trim().length > 0) {
          var d = JSON.parse(bakRaw);
          console.log("[恢复] 已从备份文件恢复数据");
          saveData(d);
          return d;
        }
      } catch(e2) { console.error("[错误] 备份恢复也失败:", e2.message); }
    }
    // 保留损坏的文件用于手动恢复
    try { if (fs.existsSync(DATA_FILE)) fs.renameSync(DATA_FILE, DATA_FILE + ".corrupted." + Date.now()); } catch(e3) {}
  }
  var init = {
    adminUsers: [
      { id: "admin_1", username: "admin", password: hashPassword("admin123"), name: "系统管理员", role: "super_admin", phone: "13800000000", mustChangePwd: true, createdAt: Date.now() },
      { id: "admin_2", username: "staff1", password: hashPassword("staff123"), name: "张师傅", role: "staff", phone: "13900000001", mustChangePwd: true, createdAt: Date.now() },
      { id: "admin_3", username: "staff2", password: hashPassword("staff123"), name: "李师傅", role: "staff", phone: "13900000002", mustChangePwd: true, createdAt: Date.now() }
    ],
    repairTasks: [],
    parts: [
      { id: "p1", name: "激光切割头喷嘴", category: "激光机配件", price: 280, stock: 50, unit: "个", image: "", desc: "适用于各类激光切割机的高品质喷嘴" },
      { id: "p2", name: "折弯机精密模具", category: "折弯机配件", price: 3500, stock: 12, unit: "套", image: "", desc: "高精度耐用折弯模具套装" },
      { id: "p3", name: "抗磨液压油 L-HM46", category: "润滑油品", price: 180, stock: 200, unit: "升", image: "", desc: "高品质抗磨液压油" },
      { id: "p4", name: "激光保护镜片", category: "激光机配件", price: 150, stock: 80, unit: "片", image: "", desc: "激光切割机专用保护镜片" },
      { id: "p5", name: "工业润滑油", category: "润滑油品", price: 120, stock: 100, unit: "升", image: "", desc: "通用工业设备润滑油" },
      { id: "p6", name: "高精度工业传感器", category: "电子配件", price: 680, stock: 20, unit: "个", image: "", desc: "高精度位置/温度传感器" },
      { id: "p7", name: "密封圈套装", category: "通用配件", price: 85, stock: 45, unit: "套", image: "", desc: "全套密封圈组件" },
      { id: "p8", name: "切割气体 氮气瓶", category: "耗材", price: 450, stock: 30, unit: "瓶", image: "", desc: "高纯度氮气 40L装" }
    ],
    outboundOrders: [],
    customerInfo: {},
    globalSettings: { paymentQR: "", companyName: "广东中科数控科技有限公司", companyShort: "中科数控", companyAddress: "广东省佛山市顺德区", companyPhone: "0757-88886666" },
    taskIdCounter: 0, orderIdCounter: 0
  };
  console.log("[初始化] 数据文件不存在或损坏，已创建新数据文件");
  saveData(init);
  return init;
}


function saveData(d) { try { var bak = DATA_FILE + ".bak"; if (fs.existsSync(DATA_FILE)) { try { fs.copyFileSync(DATA_FILE, bak); } catch(e) {} } fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf8"); } catch(e) { console.error("[错误] 保存数据失败:", e.message); } }

function loadAudit() {
  try { if (fs.existsSync(AUDIT_FILE)) { var parsed = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); return Array.isArray(parsed) ? parsed : []; } } catch(e) {}
  return [];
}
function saveAudit(a) { try { var bak = AUDIT_FILE + ".bak"; if (fs.existsSync(AUDIT_FILE)) { try { fs.copyFileSync(AUDIT_FILE, bak); } catch(e) {} } fs.writeFileSync(AUDIT_FILE, JSON.stringify(a, null, 2), "utf8"); } catch(e) { console.error("[错误] 保存审计日志失败:", e.message); } }
function addAudit(type, phone, detail, ip) {
  var a = loadAudit(); if (!Array.isArray(a)) a = [];
  a.push({ type: type, phone: phone || '', detail: detail || '', ip: ip || '', time: Date.now() });
  if (a.length > 10000) a = a.slice(-9000);
  saveAudit(a);
}

var SERVER_STATS = { startTime: Date.now(), totalRequests: 0, apiRequests: 0, dailyVisits: {}, uniqueIPs: {}, todayCount: 0, todayDate: '' };
function recordVisit(ip, pathname) {
  SERVER_STATS.totalRequests++;
  if (pathname && pathname.startsWith('/api/')) SERVER_STATS.apiRequests++;
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  if (SERVER_STATS.todayDate !== today) { SERVER_STATS.todayDate = today; SERVER_STATS.todayCount = 0; }
  SERVER_STATS.todayCount++;
  if (!SERVER_STATS.dailyVisits[today]) SERVER_STATS.dailyVisits[today] = { count: 0, ips: {} };
  SERVER_STATS.dailyVisits[today].count++;
  if (ip) { SERVER_STATS.dailyVisits[today].ips[ip] = (SERVER_STATS.dailyVisits[today].ips[ip] || 0) + 1; SERVER_STATS.uniqueIPs[ip] = (SERVER_STATS.uniqueIPs[ip] || 0) + 1; }
}
function getUptime() {
  var s = Math.floor((Date.now() - SERVER_STATS.startTime) / 1000);
  var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  var parts = []; if (d > 0) parts.push(d + '天'); if (h > 0 || d > 0) parts.push(h + '时'); parts.push(m + '分'); parts.push(sec + '秒');
  return parts.join(' ');
}

// 修正保修期计算：使用实际月份而非 30 天近似
function calcWarranty(mfgDate, faultDesc) {
  if (!mfgDate) return 'unknown';
  var mfg = new Date(mfgDate);
  var months = (faultDesc && (faultDesc.indexOf('激光器') !== -1 || faultDesc.indexOf('laser') !== -1)) ? 24 : 12;
  var expiry = new Date(mfg);
  expiry.setMonth(expiry.getMonth() + months);
  return Date.now() <= expiry.getTime() ? 'in_warranty' : 'out_warranty';
}
function warrantyMonths(faultDesc) { return (faultDesc && (faultDesc.indexOf('激光器') !== -1 || faultDesc.indexOf('laser') !== -1)) ? 24 : 12; }

var MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

// 通用 CORS 头
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function sendJSON(res, code, data) {
  if (res.headersSent) return;
  var headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS_HEADERS);
  res.writeHead(code, headers);
  res.end(JSON.stringify(data));
}

// 限制请求体最大 10MB，防止内存 DoS
var MAX_BODY_SIZE = 10 * 1024 * 1024;
function parseBody(req, cb) {
  var body = '';
  var size = 0;
  req.on('data', function(c) {
    size += c.length;
    if (size > MAX_BODY_SIZE) { req.destroy(); cb(null); return; }
    body += c;
  });
  req.on('end', function() { try { cb(JSON.parse(body)); } catch(e) { cb(null); } });
}

function checkAuth(req, d) { var auth = req.headers['authorization'] || ''; if (auth.indexOf('Bearer ') === 0) auth = auth.substring(7); for (var i = 0; i < d.adminUsers.length; i++) { if (d.adminUsers[i].token && d.adminUsers[i].token === auth) return d.adminUsers[i]; } return null; }
function getClientIP(req) { return (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim(); }

function handleAPI(req, res, pathname, method) {
  if (method === 'OPTIONS') { res.writeHead(204, CORS_HEADERS); res.end(); return true; }
  var d = loadData(); var ip = getClientIP(req);

  // ==================== 客户密码登录 ====================
  if (pathname === "/api/customer/login" && method === "POST") {
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: "无效请求" });
      var phone = (b.phone || "").trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) return sendJSON(res, 400, { ok: false, msg: "手机号码格式不正确" });

      // Token自动登录（记住登录状态）
      if (b.token && d.customerInfo && d.customerInfo[phone] && d.customerInfo[phone].token === b.token) {
        d.customerInfo[phone].lastLogin = Date.now(); saveData(d);
        addAudit("customer_login", phone, "客户自动登录（记住登录状态）", ip);
        return sendJSON(res, 200, { ok: true, data: { phone: phone, displayName: phone.slice(0,3)+"****"+phone.slice(7), info: d.customerInfo[phone], token: b.token, vlogin: true } });
      }

      // 密码登录
      var password = (b.password || "").trim();
      if (!password) return sendJSON(res, 400, { ok: false, msg: "请输入密码" });

      if (!d.customerInfo) d.customerInfo = {};
      var cust = d.customerInfo[phone];
      if (!cust || !cust.password) {
        return sendJSON(res, 401, { ok: false, msg: "账号不存在或未设置密码，请联系管理员创建账号" });
      }

      if (!verifyPassword(password, cust.password)) {
        return sendJSON(res, 401, { ok: false, msg: "密码错误" });
      }

      var token = crypto.randomBytes(32).toString("hex");
      cust.lastLogin = Date.now();
      cust.token = token;
      if (!cust.status) cust.status = "active";
      saveData(d);
      addAudit("customer_login", phone, "客户密码登录", ip);
      sendJSON(res, 200, { ok: true, data: { phone: phone, displayName: phone.slice(0,3)+"****"+phone.slice(7), info: cust, token: token, vlogin: false } });
    });
    return true;
  }
  // ==================== 管理员登录 ====================
  if (pathname === '/api/admin/login' && method === 'POST') {
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: '无效请求' });
      var username = (b.username || '').trim(), password = (b.password || '').trim();
      var admin = null;
      for (var i = 0; i < d.adminUsers.length; i++) { if (d.adminUsers[i].username === username && verifyPassword(password, d.adminUsers[i].password)) { admin = d.adminUsers[i]; break; } }
      if (!admin) return sendJSON(res, 401, { ok: false, msg: '用户名或密码错误' });
      admin.token = crypto.randomBytes(32).toString('hex');
      admin.lastLogin = Date.now();
      saveData(d);
      addAudit('admin_login', admin.phone || '', '管理员登录: ' + admin.name, ip);
      sendJSON(res, 200, { ok: true, data: { id: admin.id, username: admin.username, name: admin.name, role: admin.role, phone: admin.phone || '', token: admin.token, mustChangePwd: !!admin.mustChangePwd } });
    });
    return true;
  }

  // ==================== 管理员修改自己的密码 ====================
  if (pathname === '/api/admin/change-pwd' && method === 'PUT') {
    var admPwd = checkAuth(req, d);
    if (!admPwd) return sendJSON(res, 401, { ok: false, msg: '请先登录' });
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: '无效请求' });
      if (!verifyPassword(b.oldPassword || '', admPwd.password)) return sendJSON(res, 400, { ok: false, msg: '旧密码不正确' });
      var newPwd = (b.newPassword || '').trim();
      if (newPwd.length < 6) return sendJSON(res, 400, { ok: false, msg: '新密码至少6位' });
      admPwd.password = hashPassword(newPwd);
      admPwd.mustChangePwd = false;
      saveData(d);
      sendJSON(res, 200, { ok: true, msg: '密码修改成功' });
    });
    return true;
  }

  // ==================== 客户自动登录（token校验） ====================
  if (pathname === '/api/customer/relogin' && method === 'POST') {
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: '无效请求' });
      var phone = (b.phone || '').trim(), token = (b.token || '').trim();
      if (!phone || !token) return sendJSON(res, 400, { ok: false, msg: '缺少参数' });
      var info = d.customerInfo && d.customerInfo[phone];
      if (info && info.token === token) {
        info.lastLogin = Date.now(); saveData(d);
        return sendJSON(res, 200, { ok: true, data: { phone: phone, displayName: phone.slice(0,3)+'****'+phone.slice(7), info: info, token: token } });
      }
      sendJSON(res, 401, { ok: false, msg: '登录已过期，请重新登录' });
    });
    return true;
  }

  // 省市区/设备部位/图片上传/Staff List
  if (pathname === '/api/regions' && method === 'GET') {
    var rq = url.parse(req.url, true).query || {};
    if (rq.province && rq.city) { var pdata = REGIONS[rq.province]; if (pdata && pdata.cities[rq.city]) return sendJSON(res, 200, { ok: true, data: pdata.cities[rq.city] }); return sendJSON(res, 200, { ok: true, data: [] }); }
    if (rq.province) { var pd = REGIONS[rq.province]; if (pd) return sendJSON(res, 200, { ok: true, data: Object.keys(pd.cities) }); return sendJSON(res, 200, { ok: true, data: [] }); }
    sendJSON(res, 200, { ok: true, data: Object.keys(REGIONS) }); return true;
  }
  if (pathname === '/api/equipment-parts' && method === 'GET') { var eq = (url.parse(req.url, true).query || {}).type || ''; sendJSON(res, 200, { ok: true, data: EQUIPMENT_PARTS[eq] || EQUIPMENT_PARTS['其他设备'] || [] }); return true; }
  if (pathname === '/api/upload' && method === 'POST') {
    var admImg = checkAuth(req, d); if (!admImg) return sendJSON(res, 401);
    var chunks = [], upSize = 0, MAX_UPLOAD = 20 * 1024 * 1024;
    req.on('data', function(c) { upSize += c.length; if (upSize > MAX_UPLOAD) { req.destroy(); return; } chunks.push(c); });
    req.on('end', function() {
      if (upSize > MAX_UPLOAD) return sendJSON(res, 413, { ok: false, msg: '文件过大，最大20MB' });
      try { var buf = Buffer.concat(chunks); var ct = req.headers['content-type'] || '';
        try { var json = JSON.parse(buf.toString()); if (json.image) { var fn = 'img_' + Date.now() + Math.random().toString(36).slice(2, 6) + '.png'; fs.writeFileSync(path.join(UPLOAD_DIR, fn), Buffer.from(json.image.replace(/^data:image\/\w+;base64,/, ''), 'base64')); sendJSON(res, 200, { ok: true, data: { url: '/uploads/' + fn } }); return; } } catch(e) {}
        if (ct.indexOf('image/') !== -1) { var ext = ct.split('/')[1].replace('jpeg', 'jpg') || 'png'; var fn2 = 'img_' + Date.now() + Math.random().toString(36).slice(2, 6) + '.' + ext; fs.writeFileSync(path.join(UPLOAD_DIR, fn2), buf); sendJSON(res, 200, { ok: true, data: { url: '/uploads/' + fn2 } }); return; }
        sendJSON(res, 400, { ok: false, msg: '不支持的格式' });
      } catch(e) { sendJSON(res, 500, { ok: false, msg: '上传出错' }); }
    }); return true;
  }
  if (pathname === '/api/admin/staff' && method === 'GET') { var admSt = checkAuth(req, d); if (!admSt) return sendJSON(res, 401); var staff = d.adminUsers.filter(function(u) { return u.role === 'staff'; }).map(function(u) { return { id: u.id, name: u.name, username: u.username, phone: u.phone || '' }; }); sendJSON(res, 200, { ok: true, data: staff }); return true; }

  // ==================== Tasks ====================
  if (pathname === '/api/tasks' && method === 'GET') {
    var q = url.parse(req.url, true).query || {}; var tasks = d.repairTasks || [];
    if (q.phone) tasks = tasks.filter(function(t) { return t.customerPhone === q.phone; });
    if (q.status) tasks = tasks.filter(function(t) { return t.status === q.status; });
    tasks.sort(function(a, b) { return b.createdAt - a.createdAt; });
    var enriched = tasks.map(function(t) { return Object.assign({}, t, { warrantyStatus: calcWarranty(t.manufactureDate, t.faultDescription), warrantyMonths: warrantyMonths(t.faultDescription) }); });
    sendJSON(res, 200, { ok: true, data: enriched, total: enriched.length }); return true;
  }
  if (pathname === '/api/tasks' && method === 'POST') {
    parseBody(req, function(b) { if (!b) return sendJSON(res, 400); d.taskIdCounter = (d.taskIdCounter || 0) + 1; var ws = calcWarranty(b.manufactureDate, b.faultDescription); var wm = warrantyMonths(b.faultDescription);
      var task = { id: 'RK-' + String(d.taskIdCounter).padStart(6, '0'), customerPhone: b.customerPhone || '', customerName: b.customerName || '', factoryName: b.factoryName || '', address: b.address || '', province: b.province || '', city: b.city || '', district: b.district || '', detailAddress: b.detailAddress || '', machineType: b.machineType || '', machinePart: b.machinePart || '', machineSn: b.machineSn || '', manufactureDate: b.manufactureDate || null, expectedDate: b.expectedDate || null, faultDescription: b.faultDescription || '', photos: b.photos || [], status: 'pending', warrantyStatus: ws, warrantyMonths: wm, statusHistory: [{ status: 'pending', time: Date.now(), note: '客户提交报修申请', operator: '系统' }], createdAt: Date.now(), updatedAt: Date.now(), resolution: '', assignedTo: '', assigneeName: '', assigneePhone: '', acceptTime: null, quotation: null, quotationStatus: '', quotationApprovedAt: null, repairStartTime: null, repairEndTime: null, repairCost: 0, repairItems: [] };
      d.repairTasks.push(task); saveData(d);
      addAudit('task_create', b.customerPhone, '创建报修工单 ' + task.id + ' 设备:' + (b.machineType||'') + ' 部位:' + (b.machinePart||''), ip);
      sendJSON(res, 200, { ok: true, data: task });
    }); return true;
  }
  if (pathname.match(/^\/api\/tasks\/[^\/]+$/) && method === 'PUT') {
    var taskId = pathname.split('/')[3]; var admin = checkAuth(req, d); if (!admin) return sendJSON(res, 401);
    parseBody(req, function(b) { if (!b) return sendJSON(res, 400); var found = false;
      for (var i = 0; i < d.repairTasks.length; i++) { if (d.repairTasks[i].id === taskId) { var t = d.repairTasks[i]; var names = { pending: '待处理', processing: '处理中', completed: '已完成', cancelled: '已取消' };
        if (b.status) { t.status = b.status; t.updatedAt = Date.now(); if (!t.statusHistory) t.statusHistory = []; t.statusHistory.push({ status: b.status, time: Date.now(), note: b.note || ('状态变更为：' + (names[b.status] || b.status)), operator: admin.name }); }
        if (b.resolution !== undefined) { t.resolution = b.resolution; t.updatedAt = Date.now(); }
        if (b.assignedTo !== undefined) { t.assignedTo = b.assignedTo; t.assigneeName = b.assigneeName || ''; t.assigneePhone = b.assigneePhone || ''; t.acceptTime = b.acceptTime || null; t.updatedAt = Date.now(); if (!t.statusHistory) t.statusHistory = []; if (b.assigneeName) t.statusHistory.push({ status: t.status, time: Date.now(), note: '指派售后人员：' + b.assigneeName + (b.assigneePhone ? ' (' + b.assigneePhone + ')' : ''), operator: admin.name }); }
        if (b.quotation !== undefined) { t.quotation = b.quotation; t.quotationStatus = b.quotationStatus || 'pending_approval'; t.quotationApprovedAt = b.quotationStatus === 'approved' ? Date.now() : null; t.updatedAt = Date.now(); if (!t.statusHistory) t.statusHistory = []; t.statusHistory.push({ status: t.status, time: Date.now(), note: b.quotationStatus === 'approved' ? '维修报价已审批通过：¥' + (b.quotation || 0) : (b.quotationStatus === 'rejected' ? '报价审批被拒绝' : '已提交维修报价：¥' + (b.quotation || 0)), operator: admin.name }); }
        if (b.quotationStatus !== undefined && b.quotation === undefined) { t.quotationStatus = b.quotationStatus; t.updatedAt = Date.now(); if (b.quotationStatus === 'approved') t.quotationApprovedAt = Date.now(); if (!t.statusHistory) t.statusHistory = []; t.statusHistory.push({ status: t.status, time: Date.now(), note: b.quotationStatus === 'approved' ? '管理员审批通过了报价' : '管理员拒绝了报价', operator: admin.name }); }
        if (b.repairStartTime !== undefined) { t.repairStartTime = b.repairStartTime; t.updatedAt = Date.now(); }
        if (b.repairEndTime !== undefined) { t.repairEndTime = b.repairEndTime; t.updatedAt = Date.now(); }
        if (b.repairCost !== undefined) { t.repairCost = parseFloat(b.repairCost) || 0; t.updatedAt = Date.now(); }
        if (b.repairItems !== undefined) { t.repairItems = b.repairItems; t.updatedAt = Date.now(); }
        if (b.acceptTime !== undefined) { t.acceptTime = b.acceptTime; t.updatedAt = Date.now(); }
        found = true; break;
      } }
      if (!found) return sendJSON(res, 404, { ok: false, msg: '工单不存在' });
      saveData(d); sendJSON(res, 200, { ok: true });
    }); return true;
  }


  // ==================== 客户账号管理（管理员） ====================
  if (pathname === "/api/admin/customers" && method === "GET") {
    var admCust = checkAuth(req, d);
    if (!admCust) return sendJSON(res, 401, { ok: false, msg: "请先登录" });
    var customers = [];
    var info = d.customerInfo || {};
    var phones = Object.keys(info);
    for (var i = 0; i < phones.length; i++) {
      var c = info[phones[i]];
      customers.push({
        phone: c.phone || phones[i],
        factoryName: c.factoryName || "",
        province: c.province || "",
        city: c.city || "",
        district: c.district || "",
        detailAddress: c.detailAddress || "",
        contactPerson: c.contactPerson || "",
        createdAt: c.createdAt || 0,
        lastLogin: c.lastLogin || 0,
        status: c.status || "active",
        hasPassword: !!c.password
      });
    }
    customers.sort(function(a, b) { return b.createdAt - a.createdAt; });
    sendJSON(res, 200, { ok: true, data: customers, total: customers.length });
    return true;
  }

  if (pathname === "/api/admin/customers" && method === "POST") {
    var admCust2 = checkAuth(req, d);
    if (!admCust2) return sendJSON(res, 401, { ok: false, msg: "请先登录" });
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: "无效请求" });
      var phone = (b.phone || "").trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) return sendJSON(res, 400, { ok: false, msg: "手机号码格式不正确" });
      var password = (b.password || "").trim();
      if (password.length < 6) return sendJSON(res, 400, { ok: false, msg: "密码至少6位" });
      if (!d.customerInfo) d.customerInfo = {};
      if (d.customerInfo[phone]) return sendJSON(res, 400, { ok: false, msg: "该手机号已注册" });
      d.customerInfo[phone] = {
        phone: phone,
        password: hashPassword(password),
        factoryName: b.factoryName || "",
        province: b.province || "",
        city: b.city || "",
        district: b.district || "",
        detailAddress: b.detailAddress || "",
        contactPerson: b.contactPerson || "",
        createdAt: Date.now(),
        lastLogin: 0,
        token: "",
        status: "active"
      };
      saveData(d);
      addAudit("customer_create", phone, "管理员 " + admCust2.name + " 创建客户账号: " + (b.factoryName || phone), ip);
      sendJSON(res, 200, { ok: true, msg: "客户账号创建成功" });
    });
    return true;
  }

  if (pathname.match(/^\/api\/admin\/customers\/[^\/]+$/) && method === "PUT") {
    var custPhone = decodeURIComponent(pathname.split("/")[4]);
    var admCust3 = checkAuth(req, d);
    if (!admCust3) return sendJSON(res, 401, { ok: false, msg: "请先登录" });
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400, { ok: false, msg: "无效请求" });
      if (!d.customerInfo || !d.customerInfo[custPhone]) return sendJSON(res, 404, { ok: false, msg: "客户不存在" });
      var c = d.customerInfo[custPhone];
      if (b.password !== undefined && b.password !== "") c.password = hashPassword(b.password);
      if (b.factoryName !== undefined) c.factoryName = b.factoryName;
      if (b.province !== undefined) c.province = b.province;
      if (b.city !== undefined) c.city = b.city;
      if (b.district !== undefined) c.district = b.district;
      if (b.detailAddress !== undefined) c.detailAddress = b.detailAddress;
      if (b.contactPerson !== undefined) c.contactPerson = b.contactPerson;
      if (b.status !== undefined) c.status = b.status;
      saveData(d);
      addAudit("customer_update", custPhone, "管理员 " + admCust3.name + " 更新客户信息", ip);
      sendJSON(res, 200, { ok: true, msg: "客户信息已更新" });
    });
    return true;
  }

  if (pathname.match(/^\/api\/admin\/customers\/[^\/]+$/) && method === "DELETE") {
    var custPhone2 = decodeURIComponent(pathname.split("/")[4]);
    var admCust4 = checkAuth(req, d);
    if (!admCust4 || admCust4.role !== "super_admin") return sendJSON(res, 401, { ok: false, msg: "仅超级管理员可删除客户" });
    if (d.customerInfo && d.customerInfo[custPhone2]) {
      delete d.customerInfo[custPhone2];
      saveData(d);
      addAudit("customer_delete", custPhone2, "管理员 " + admCust4.name + " 删除客户账号", ip);
      sendJSON(res, 200, { ok: true, msg: "客户已删除" });
    } else {
      sendJSON(res, 404, { ok: false, msg: "客户不存在" });
    }
    return true;
  }
  // Parts/Stock/Orders
  if (pathname === '/api/parts' && method === 'GET') { sendJSON(res, 200, { ok: true, data: d.parts || [] }); return true; }
  if (pathname === '/api/parts' && method === 'POST') { var adm = checkAuth(req, d); if (!adm) return sendJSON(res, 401); parseBody(req, function(b) { if (!b) return sendJSON(res, 400); d.parts.push({ id: 'p' + Date.now(), name: b.name || '', category: b.category || '', price: parseFloat(b.price) || 0, stock: parseInt(b.stock) || 0, unit: b.unit || '件', image: b.image || '', desc: b.desc || '' }); saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname.match(/^\/api\/parts\/[^\/]+$/) && method === 'PUT') { var pid = pathname.split('/')[3]; var adm2 = checkAuth(req, d); if (!adm2) return sendJSON(res, 401); parseBody(req, function(b) { for (var i = 0; i < d.parts.length; i++) { if (d.parts[i].id === pid) { var part = d.parts[i]; if (b.name !== undefined) part.name = b.name; if (b.category !== undefined) part.category = b.category; if (b.price !== undefined) part.price = parseFloat(b.price) || 0; if (b.stock !== undefined) part.stock = parseInt(b.stock) || 0; if (b.unit !== undefined) part.unit = b.unit; if (b.image !== undefined) part.image = b.image; if (b.desc !== undefined) part.desc = b.desc; break; } } saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname.match(/^\/api\/parts\/[^\/]+$/) && method === 'DELETE') { var pid2 = pathname.split('/')[3]; var adm3 = checkAuth(req, d); if (!adm3) return sendJSON(res, 401); d.parts = d.parts.filter(function(p) { return p.id !== pid2; }); saveData(d); sendJSON(res, 200, { ok: true }); return true; }
  if (pathname.match(/^\/api\/parts\/[^\/]+\/stock$/) && method === 'POST') { var pid3 = pathname.split('/')[3]; var adm4 = checkAuth(req, d); if (!adm4) return sendJSON(res, 401); parseBody(req, function(b) { var type = b.type || 'in', qty = parseInt(b.qty) || 0; if (qty <= 0) return sendJSON(res, 400, { ok: false, msg: '数量无效' }); for (var i = 0; i < d.parts.length; i++) { if (d.parts[i].id === pid3) { if (type === 'out' && d.parts[i].stock < qty) return sendJSON(res, 400, { ok: false, msg: '库存不足' }); d.parts[i].stock = type === 'in' ? d.parts[i].stock + qty : d.parts[i].stock - qty; break; } } saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname === '/api/orders' && method === 'GET') { var q2 = (url.parse(req.url, true).query || {}); var orders = d.outboundOrders || []; if (q2.phone) orders = orders.filter(function(o) { return o.customerPhone === q2.phone; }); orders.sort(function(a, b) { return b.createdAt - a.createdAt; }); sendJSON(res, 200, { ok: true, data: orders, total: orders.length }); return true; }
  if (pathname === '/api/orders' && method === 'POST') {
    // 管理员创建或客户自助下单
    var admOrd = checkAuth(req, d);
    parseBody(req, function(b) {
      if (!b) return sendJSON(res, 400);
      // 非管理员创建订单时，必须提供客户手机号（客户自助下单）
      d.orderIdCounter = (d.orderIdCounter || 0) + 1;
      var items = b.items || [], total = 0;
      for (var i = 0; i < items.length; i++) total += (items[i].subtotal || 0);
      if (items.length === 0) return sendJSON(res, 400, { ok: false, msg: '订单必须包含至少一个配件' });
      // 扣减库存
      for (var k = 0; k < items.length; k++) {
        for (var m = 0; m < d.parts.length; m++) {
          if (d.parts[m].id === items[k].partId) {
            if (d.parts[m].stock < items[k].qty) return sendJSON(res, 400, { ok: false, msg: '配件 "' + d.parts[m].name + '" 库存不足（当前库存：' + d.parts[m].stock + '）' });
            d.parts[m].stock = Math.max(0, d.parts[m].stock - (items[k].qty || 0));
            break;
          }
        }
      }
      var order = { id: 'CK-' + String(d.orderIdCounter).padStart(6, '0'), customerPhone: b.customerPhone || '', customerName: b.customerName || '', factoryName: b.factoryName || '', address: b.address || '', items: items, total: total, status: admOrd ? 'shipped' : 'pending_payment', createdAt: Date.now(), paidAt: admOrd ? Date.now() : null, shippedAt: admOrd ? Date.now() : null, outboundBy: b.outboundBy || (admOrd ? admOrd.name : ''), outboundNote: b.outboundNote || '', relatedTaskId: b.relatedTaskId || '' };
      d.outboundOrders.push(order); saveData(d);
      addAudit('order_create', b.customerPhone, '创建出库单 ' + order.id + ' 金额:¥' + total.toFixed(2), getClientIP(req));
      sendJSON(res, 200, { ok: true, data: order });
    }); return true;
  }
  if (pathname.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') { var oid = pathname.split('/')[3]; parseBody(req, function(b) { for (var i = 0; i < d.outboundOrders.length; i++) { if (d.outboundOrders[i].id === oid) { d.outboundOrders[i].status = b.status || d.outboundOrders[i].status; if (b.status === 'paid') d.outboundOrders[i].paidAt = Date.now(); if (b.status === 'shipped') d.outboundOrders[i].shippedAt = Date.now(); break; } } saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname.match(/^\/api\/orders\/[^\/]+$/) && method === 'DELETE') { var oid2 = pathname.split('/')[3]; var adm5 = checkAuth(req, d); if (!adm5) return sendJSON(res, 401); d.outboundOrders = d.outboundOrders.filter(function(o) { return o.id !== oid2; }); saveData(d); sendJSON(res, 200, { ok: true }); return true; }
  if (pathname.match(/^\/api\/orders\/[^\/]+\/print$/) && method === 'GET') { var oid3 = pathname.split('/')[3]; for (var i = 0; i < d.outboundOrders.length; i++) { if (d.outboundOrders[i].id === oid3) return sendJSON(res, 200, { ok: true, data: d.outboundOrders[i], settings: d.globalSettings || {} }); } sendJSON(res, 404); return true; }
  if (pathname.match(/^\/api\/tasks\/[^\/]+\/print$/) && method === 'GET') { var tid = pathname.split('/')[3]; for (var i = 0; i < d.repairTasks.length; i++) { if (d.repairTasks[i].id === tid) return sendJSON(res, 200, { ok: true, data: Object.assign({}, d.repairTasks[i], { warrantyStatus: calcWarranty(d.repairTasks[i].manufactureDate, d.repairTasks[i].faultDescription), warrantyMonths: warrantyMonths(d.repairTasks[i].faultDescription) }), settings: d.globalSettings || {} }); } sendJSON(res, 404); return true; }

  // Customer Info / Accounts / Settings / Audit / Staff-Performance / Stats
  if (pathname === '/api/customer/info' && method === 'GET') { sendJSON(res, 200, { ok: true, data: (d.customerInfo && d.customerInfo[(url.parse(req.url, true).query||{}).phone||'']) || {} }); return true; }
  if (pathname === '/api/customer/info' && method === 'PUT') { parseBody(req, function(b) { var cp = b.phone; if (!cp) return sendJSON(res, 400); if (!d.customerInfo) d.customerInfo = {}; if (!d.customerInfo[cp]) d.customerInfo[cp] = {}; var ci = d.customerInfo[cp]; if (b.factoryName !== undefined) ci.factoryName = b.factoryName; if (b.province !== undefined) ci.province = b.province; if (b.city !== undefined) ci.city = b.city; if (b.district !== undefined) ci.district = b.district; if (b.detailAddress !== undefined) ci.detailAddress = b.detailAddress; if (b.address !== undefined) ci.address = b.address; saveData(d); sendJSON(res, 200, { ok: true, data: ci }); }); return true; }
  if (pathname === '/api/admin/accounts' && method === 'GET') { var adm6 = checkAuth(req, d); if (!adm6 || adm6.role !== 'super_admin') return sendJSON(res, 401); sendJSON(res, 200, { ok: true, data: d.adminUsers.map(function(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, phone: u.phone || '', createdAt: u.createdAt, lastLogin: u.lastLogin || null }; }) }); return true; }
  if (pathname === '/api/admin/accounts' && method === 'POST') { var adm7 = checkAuth(req, d); if (!adm7 || adm7.role !== 'super_admin') return sendJSON(res, 401); parseBody(req, function(b) { if (!b || !b.username || !b.password) return sendJSON(res, 400, { ok: false, msg: '参数不完整' }); if (d.adminUsers.find(function(u) { return u.username === b.username; })) return sendJSON(res, 400, { ok: false, msg: '用户名已存在' }); d.adminUsers.push({ id: 'admin_' + Date.now(), username: b.username, password: hashPassword(b.password), name: b.name, role: b.role || 'staff', phone: b.phone || '', mustChangePwd: true, createdAt: Date.now() }); saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname.match(/^\/api\/admin\/accounts\/[^\/]+$/) && method === 'PUT') { var aid = pathname.split('/')[3]; var admA = checkAuth(req, d); if (!admA || admA.role !== 'super_admin') return sendJSON(res, 401); parseBody(req, function(b) { for (var i = 0; i < d.adminUsers.length; i++) { if (d.adminUsers[i].id === aid) { if (b.password !== undefined) d.adminUsers[i].password = hashPassword(b.password); if (b.phone !== undefined) d.adminUsers[i].phone = b.phone; if (b.name !== undefined) d.adminUsers[i].name = b.name; if (b.username !== undefined) d.adminUsers[i].username = b.username; break; } } saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname === '/api/settings' && method === 'GET') { sendJSON(res, 200, { ok: true, data: d.globalSettings || {} }); return true; }
  if (pathname === '/api/settings' && method === 'PUT') { var adm8 = checkAuth(req, d); if (!adm8 || adm8.role !== 'super_admin') return sendJSON(res, 401); parseBody(req, function(b) { if (!d.globalSettings) d.globalSettings = {}; if (b.paymentQR !== undefined) d.globalSettings.paymentQR = b.paymentQR; if (b.companyName !== undefined) d.globalSettings.companyName = b.companyName; if (b.companyShort !== undefined) d.globalSettings.companyShort = b.companyShort; if (b.companyAddress !== undefined) d.globalSettings.companyAddress = b.companyAddress; if (b.companyPhone !== undefined) d.globalSettings.companyPhone = b.companyPhone; saveData(d); sendJSON(res, 200, { ok: true }); }); return true; }
  if (pathname === '/api/admin/audit' && method === 'GET') { var admAud = checkAuth(req, d); if (!admAud || admAud.role !== 'super_admin') return sendJSON(res, 401); var qa = url.parse(req.url, true).query || {}; var page = parseInt(qa.page) || 1, limit = Math.min(parseInt(qa.limit) || 50, 200); var audits = loadAudit(); if (qa.type) audits = audits.filter(function(x) { return x.type === qa.type; }); if (qa.phone) audits = audits.filter(function(x) { return x.phone === qa.phone; }); if (qa.startDate) audits = audits.filter(function(x) { return x.time >= new Date(qa.startDate).getTime(); }); if (qa.endDate) audits = audits.filter(function(x) { return x.time < new Date(qa.endDate).getTime() + 86400000; }); audits.sort(function(a, b) { return b.time - a.time; }); sendJSON(res, 200, { ok: true, data: audits.slice((page-1)*limit, page*limit), total: audits.length, page: page, limit: limit }); return true; }
  if (pathname === '/api/admin/staff-performance' && method === 'GET') {
    var admPerf = checkAuth(req, d); if (!admPerf || admPerf.role !== 'super_admin') return sendJSON(res, 401); var qp2 = url.parse(req.url, true).query || {}; var staffId = qp2.staffId || '', startDate = qp2.startDate ? new Date(qp2.startDate).getTime() : 0, endDate = qp2.endDate ? new Date(qp2.endDate).getTime() + 86400000 : Date.now() + 86400000; var tasks = d.repairTasks || [], result = [];
    for (var i = 0; i < tasks.length; i++) { var t = tasks[i]; if (!t.statusHistory) continue; for (var h = 0; h < t.statusHistory.length; h++) { var sh = t.statusHistory[h], shTime = sh.time || 0; if (shTime < startDate || shTime > endDate) continue; var opName = sh.operator || ''; if (staffId) { var matched = d.adminUsers.find(function(u) { return u.id === staffId && u.name === opName; }); if (!matched) continue; } result.push({ taskId: t.id, machineType: t.machineType || '', machinePart: t.machinePart || '', customerName: t.customerName || '', customerPhone: t.customerPhone || '', factoryName: t.factoryName || '', action: sh.note || '', status: sh.status || '', operator: opName, time: shTime }); } }
    result.sort(function(a, b) { return b.time - a.time; }); var dailyStats = {}; for (var k = 0; k < result.length; k++) { var r = result[k]; var day = new Date(r.time).toISOString().slice(0, 10); if (!dailyStats[day]) dailyStats[day] = { date: day, count: 0, completed: 0, details: [] }; dailyStats[day].count++; if (r.status === 'completed') dailyStats[day].completed++; dailyStats[day].details.push(r); }
    sendJSON(res, 200, { ok: true, data: { totalActions: result.length, dailyStats: Object.values(dailyStats).sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,60), details: result.slice(0,200) } }); return true;
  }
  if (pathname === '/api/server-stats' && method === 'GET') { var dailyData = Object.keys(SERVER_STATS.dailyVisits).sort().reverse().slice(0, 7).map(function(dk) { return { date: dk, count: SERVER_STATS.dailyVisits[dk].count, uniqueIPs: Object.keys(SERVER_STATS.dailyVisits[dk].ips).length }; }); sendJSON(res, 200, { ok: true, data: { uptime: getUptime(), startTime: SERVER_STATS.startTime, totalRequests: SERVER_STATS.totalRequests, apiRequests: SERVER_STATS.apiRequests, todayCount: SERVER_STATS.todayCount, uniqueIPsTotal: Object.keys(SERVER_STATS.uniqueIPs).length, dailyStats: dailyData } }); return true; }
  if (pathname === '/api/stats' && method === 'GET') {
    var adm9 = checkAuth(req, d); if (!adm9) return sendJSON(res, 401); var tasks = d.repairTasks || [], stats = { totalTasks: tasks.length, pending: tasks.filter(function(t){return t.status==='pending';}).length, processing: tasks.filter(function(t){return t.status==='processing';}).length, completed: tasks.filter(function(t){return t.status==='completed';}).length, totalOrders: (d.outboundOrders||[]).length, pendingPayment: (d.outboundOrders||[]).filter(function(o){return o.status==='pending_payment';}).length, paid: (d.outboundOrders||[]).filter(function(o){return o.status==='paid';}).length, totalParts: (d.parts||[]).length, inWarranty: tasks.filter(function(t){return calcWarranty(t.manufactureDate,t.faultDescription)==='in_warranty';}).length, outWarranty: tasks.filter(function(t){return calcWarranty(t.manufactureDate,t.faultDescription)==='out_warranty';}).length, pendingQuotation: tasks.filter(function(t){return t.quotationStatus==='pending_approval';}).length, staffStats: {}, customerCount: Object.keys(d.customerInfo||{}).length };
    for (var k = 0; k < tasks.length; k++) { var t = tasks[k]; if (t.statusHistory) for (var h = 0; h < t.statusHistory.length; h++) { var op = t.statusHistory[h].operator || '未知'; if (!stats.staffStats[op]) stats.staffStats[op] = { processed: 0, completed: 0 }; stats.staffStats[op].processed++; if (t.statusHistory[h].status === 'completed') stats.staffStats[op].completed++; } }
    for (var s in stats.staffStats) { var matched = d.adminUsers.find(function(u) { return u.name === s; }); if (matched) { stats.staffStats[s].id = matched.id; stats.staffStats[s].phone = matched.phone || ''; } }
    sendJSON(res, 200, { ok: true, data: stats }); return true;
  }
  return false;
}

// 安全文件服务：防止路径遍历攻击
function serveFile(res, filePath) {
  if (filePath === '/' || filePath.endsWith('/')) filePath += 'index.html';
  if (!path.extname(filePath)) filePath += '.html';

  var cleanPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  var fullPath = path.join(__dirname, cleanPath);

  // 确保解析后的路径在项目目录内
  var normalizedDir = path.normalize(__dirname);
  var resolvedPath = path.resolve(fullPath);
  if (resolvedPath.indexOf(normalizedDir) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>403 Forbidden</h1>');
    return;
  }

  var ext = path.extname(resolvedPath).toLowerCase();
  var ct = MIME[ext] || 'application/octet-stream';
  fs.readFile(resolvedPath, function(err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<h1>404 Not Found</h1>'); return; }
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

var server = http.createServer(function(req, res) {
  var parsed = url.parse(req.url); var pathname = parsed.pathname; var method = req.method; var clientIP = getClientIP(req);
  if (pathname.startsWith('/uploads/')) {
    var upPath = path.join(UPLOAD_DIR, path.normalize(pathname.replace('/uploads/', '')).replace(/^(\.\.[\/\\])+/, ''));
    // 确保上传文件路径在 UPLOAD_DIR 内
    if (path.resolve(upPath).indexOf(path.resolve(UPLOAD_DIR)) !== 0) { res.writeHead(403); res.end('403'); return; }
    fs.stat(upPath, function(err, stat) { if (err || !stat.isFile()) { res.writeHead(404); res.end('404'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(upPath).toLowerCase()] || 'image/png', 'Cache-Control': 'max-age=86400' }); fs.createReadStream(upPath).pipe(res); }); return;
  }
  recordVisit(clientIP, pathname);
  if (pathname.startsWith("/api/") && method !== "OPTIONS") console.log("[" + new Date().toISOString() + "] " + method + " " + pathname + " from " + clientIP);
  if (pathname.startsWith('/api/')) { var handled = handleAPI(req, res, pathname, method); if (!handled) sendJSON(res, 404, { ok: false, msg: '接口不存在' }); return; }
  if (pathname === '/' || pathname === '/index.html') { serveFile(res, '/index.html'); return; }
  if (pathname === '/admin' || pathname === '/admin.html') { serveFile(res, '/admin.html'); return; }
  serveFile(res, pathname);
});

// 服务器错误处理
server.on('error', function(err) {
  console.error('[错误] 服务器启动失败:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('[错误] 端口 ' + PORT + ' 已被占用，请先停止占用该端口的程序或修改 PORT 变量');
  }
  process.exit(1);
});

// 定期清理过期的验证码（每5分钟）
setInterval(function() {
  var now = Date.now();
  var cleaned = 0;
  for (var phone in VCodes) {
    if (VCodes[phone].time && (now - VCodes[phone].time) > 600000) {
      delete VCodes[phone];
      cleaned++;
    }
  }
  if (cleaned > 0) console.log('[清理] 已清理 ' + cleaned + ' 条过期验证码');
}, 300000);

// 定期清理统计缓存中的过期 IP 数据（每天凌晨清理超过30天的数据）
setInterval(function() {
  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var keys = Object.keys(SERVER_STATS.dailyVisits);
  var removed = 0;
  for (var i = 0; i < keys.length; i++) {
    if (new Date(keys[i]).getTime() < cutoff) {
      delete SERVER_STATS.dailyVisits[keys[i]];
      removed++;
    }
  }
  if (removed > 0) console.log('[清理] 已清理 ' + removed + ' 天过期统计数据');
}, 3600000);

server.listen(PORT, '0.0.0.0', function() { console.log('中科数控售后系统运行在 http://localhost:' + PORT + ' | Ctrl+C 停止'); });