require('./env');
function childNames(profile={}){
  const fullName=typeof profile.owner==='string'&&profile.owner.trim()?profile.owner.trim():process.env.PET_OWNER_NICKNAME||'朋友';
  const nickname=typeof profile.ownerNickname==='string'&&profile.ownerNickname.trim()?profile.ownerNickname.trim():fullName;
  return {fullName,nickname};
}
function personalizeText(value,profile){return typeof value==='string'?value.replace(/小?主人(?!公)/g,childNames(profile).nickname):value;}
function personalizeStory(raw,profile){if(!raw)return raw;const story={...raw};for(const k of ['title','intro','ending'])story[k]=personalizeText(story[k],profile);if(Array.isArray(raw.scenes))story.scenes=raw.scenes.map(s=>{const next={...s};for(const k of ['narration','caption','imagePrompt'])next[k]=personalizeText(next[k],profile);return next;});return story;}
function unsupportedSharedHistory(value,profile){const escape=n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const {fullName,nickname}=childNames(profile);return new RegExp(`(?:主人|${escape(fullName)}|${escape(nickname)})(?:教|带我|告诉我|说过|送给我)|你(?:教过|教我|带我|说过|送给我)`).test(value);}
module.exports={childNames,personalizeText,personalizeStory,unsupportedSharedHistory};
