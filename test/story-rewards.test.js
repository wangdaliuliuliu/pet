const {test}=require('node:test'),assert=require('node:assert/strict');
const rewards=require('../story-rewards'),home=require('../home-service');
function state(){const value={readings:0,claimedRewards:0,food:0,feeds:0,stories:[]};home.migrate(value);return value;}
function submit(value,time,id){const story={id,createdAt:Date.parse(time)};value.stories.unshift(story);value.readings++;rewards.grant(value,story);return story;}
test('第三个故事仍保存，但每日仅新增两个额度；领取或重新加载不能解除上限',()=>{
  const s=state();submit(s,'2026-10-13T09:00:00+08:00','a');submit(s,'2026-10-13T10:00:00+08:00','b');
  home.action(s,'claim',{ingredients:['egg','tomato']});assert.equal(home.available(s),0);
  const third=submit(s,'2026-10-13T12:00:00+08:00','c');assert.equal(third.reward.granted,false);assert.equal(s.stories.length,3);assert.equal(s.readings,3);assert.equal(home.available(s),0);
  const restarted=JSON.parse(JSON.stringify(s));home.migrate(restarted);submit(restarted,'2026-10-13T23:59:59+08:00','d');assert.equal(home.available(restarted),0);assert.equal(rewards.daily(restarted,Date.parse('2026-10-13T23:59:59+08:00')).remaining,0);
});
test('按北京时间零点刷新，不是24小时冷却；旧余额和库存保留，两个存档分别计数',()=>{
  const a=state(),b=state();submit(a,'2026-10-13T23:59:58+08:00','a1');const second=submit(a,'2026-10-13T23:59:59+08:00','a2');rewards.grant(a,second);assert.equal(home.available(a),2);
  assert.equal(rewards.daily(a,Date.parse('2026-10-13T15:59:59Z')).remaining,0);assert.equal(rewards.daily(a,Date.parse('2026-10-13T16:00:00Z')).remaining,2);
  assert.equal(rewards.daily(a,Date.parse('2026-10-13T15:59:59Z')).resetAt,'2026-10-13T16:00:00.000Z');
  submit(a,'2026-10-14T00:00:00+08:00','a3');assert.equal(home.available(a),3);assert.equal(rewards.daily(a,Date.parse('2026-10-14T00:00:00+08:00')).remaining,1);
  assert.equal(rewards.daily(b,Date.parse('2026-10-13T23:59:59+08:00')).remaining,2);assert.equal(b.storyRewards.balance,0);
});
test('旧存档已有当日故事计入上限，不追扣旧食物或余额；重复迁移不能发奖',()=>{
  const s={readings:8,rewardSpent:5,homeVersion:1,stories:[0,1,2].map(n=>({id:'old-'+n,createdAt:Date.parse('2026-10-13T08:00:00+08:00')+n})),ingredients:{egg:3},dishes:{'fried-fish':2},food:1};
  home.migrate(s);assert.equal(home.available(s),3);assert.equal(rewards.daily(s,Date.parse('2026-10-13T12:00:00+08:00')).remaining,0);
  submit(s,'2026-10-13T12:00:00+08:00','new');home.migrate(s);assert.equal(home.available(s),3);assert.equal(s.ingredients.egg,3);assert.equal(s.dishes['fried-fish'],2);assert.equal(s.food,1);
  const fresh=state();assert.throws(()=>home.action(fresh,'claim',{ingredients:['fish']}),/额度/);assert.equal(fresh.storyRewards.balance,0);
});
