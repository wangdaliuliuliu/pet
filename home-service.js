const rewards = require('./story-rewards');
const INGREDIENTS = [
  { id: 'tomato', name: '西红柿', icon: '🍅' }, { id: 'egg', name: '鸡蛋', icon: '🥚' },
  { id: 'fish', name: '鱼', icon: '🐟' }, { id: 'carrot', name: '胡萝卜', icon: '🥕' },
  { id: 'potato', name: '土豆', icon: '🥔' }, { id: 'rice', name: '米饭', icon: '🍚' }
];
const RECIPES = [
  { id: 'tomato-egg', name: '西红柿炒鸡蛋', icon: '🍳', needs: ['tomato', 'egg'] },
  { id: 'fried-fish', name: '香香煎鱼', icon: '🐟', needs: ['fish'] },
  { id: 'vegetable-soup', name: '暖暖蔬菜汤', icon: '🍲', needs: ['carrot', 'potato'] },
  { id: 'egg-rice', name: '金黄蛋炒饭', icon: '🍛', needs: ['egg', 'rice'] },
  { id: 'tomato-soup', name: '番茄鱼汤', icon: '🥣', needs: ['tomato', 'fish'] },
  { id: 'potato', name: '软软蒸土豆', icon: '🥔', needs: ['potato'] }
];
const ROOMS = [
  { id: 'living', name: '宝石客厅', image: '/assets/rooms/living.webp' },
  { id: 'kitchen', name: '甜甜厨房', image: '/assets/rooms/kitchen.webp' },
  { id: 'bathroom', name: '泡泡浴室', image: '/assets/rooms/bathroom.webp' },
  { id: 'pink', name: '粉钻大卧室', image: '/assets/rooms/pink.webp' },
  { id: 'purple', name: '紫色中卧室', image: '/assets/rooms/purple.webp' },
  { id: 'blue', name: '蓝色小卧室', image: '/assets/rooms/blue.webp' }
];
function migrate(state) {
  if (!state.homeVersion) {
    // Previously claimed strawberries stay edible; spent reading rewards cannot be claimed twice.
    state.rewardSpent = state.claimedRewards * 2;
    state.ingredients = {}; state.dishes = {}; state.room = 'living';
    state.birthday = null; state.birthdayYears = []; state.homeVersion = 1;
  }
  rewards.migrate(state);
}
function available(state) { return rewards.available(state); }
function totalFood(state) { return state.food + Object.values(state.dishes).reduce((a, b) => a + b, 0); }
function chinaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
function birthdayView(state, now) {
  const date = chinaDate(now), year = Number(date.slice(0, 4));
  // Leap-day birthdays celebrate on February 28 in non-leap years.
  const expected = state.birthday === '02-29' && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1 ? '02-28' : state.birthday;
  return { date: state.birthday, today: date.slice(5) === expected, celebrated: state.birthdayYears.includes(year), year };
}
function view(state) {
  return { ingredients: INGREDIENTS, recipes: RECIPES, rooms: ROOMS, available: available(state), storyRewards: rewards.daily(state), totalFood: totalFood(state), birthday: birthdayView(state), wish: RECIPES[state.feeds % RECIPES.length] };
}
function fail(message) { const e = new Error(message); e.status = 409; throw e; }
function action(state, kind, body) {
  if (kind === 'claim') {
    const ids = body.ingredients;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => !INGREDIENTS.some(i => i.id === id))) fail('先选想要的食材吧。');
    if (ids.length > available(state)) fail('食材额度还不够，先讲一个故事并保存吧。');
    rewards.spend(state,ids.length);
    for (const id of ids) state.ingredients[id] = (state.ingredients[id] || 0) + 1;
    state.rewardSpent += ids.length;
  } else if (kind === 'cook') {
    const recipe = RECIPES.find(r => r.id === body.recipe);
    if (!recipe) fail('先选一道菜吧。');
    const missing = recipe.needs.filter(id => !state.ingredients[id]);
    if (missing.length) fail('还缺' + missing.map(id => INGREDIENTS.find(i => i.id === id).name).join('、') + '，领好食材再来做。');
    for (const id of recipe.needs) state.ingredients[id]--;
    state.dishes[recipe.id] = (state.dishes[recipe.id] || 0) + 1;
  } else if (kind === 'feed') {
    if (body.dish === 'strawberry') { if (!state.food) fail('草莓已经吃完啦。'); state.food--; }
    else {
      const id = body.dish || RECIPES.find(r => state.dishes[r.id] > 0)?.id;
      if (id && RECIPES.some(r => r.id === id) && state.dishes[id] > 0) state.dishes[id]--;
      else if (!body.dish && state.food > 0) state.food--;
      else fail('先做一道菜，再来喂小猫吧。');
    }
    state.feeds++; state.lastFedAt = Date.now();
  } else if (kind === 'room') {
    if (!ROOMS.some(r => r.id === body.room)) fail('这个房间还没有找到。'); state.room = body.room;
  } else if (kind === 'birthday') {
    if (!/^\d{2}-\d{2}$/.test(body.date || '')) fail('选一下生日的月份和日期吧。');
    const [month, day] = body.date.split('-').map(Number), d = new Date(Date.UTC(2000, month - 1, day));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) fail('这个生日日期不存在，重新选一下吧。');
    state.birthday = body.date;
  } else if (kind === 'celebrate') {
    const birthday = birthdayView(state);
    if (!birthday.today) fail('还没到生日呢，生日那天再一起吹蜡烛吧。');
    if (birthday.celebrated) fail('今年已经一起吹过蜡烛啦！');
    state.birthdayYears.push(birthday.year);
  }
}
module.exports = { INGREDIENTS, RECIPES, ROOMS, migrate, available, totalFood, view, action, birthdayView };
