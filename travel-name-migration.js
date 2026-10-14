const {childNames,personalizeText,personalizeStory}=require('./child-name');
function migrateTravelNames(state) {
  const report={...childNames(state),dates:[],photos:0,memories:0,announcements:0};
  for(const trip of Object.values(state.trips||{})) {
    const story=personalizeStory(trip.story,state);
    if(JSON.stringify(story)!==JSON.stringify(trip.story)){trip.story=story;report.dates.push(trip.date);}
    if(trip.pendingStory?.story)trip.pendingStory.story=personalizeStory(trip.pendingStory.story,state);
  }
  for(const photo of state.photos||[])if(photo.kind==='trip') {
    let changed=false;
    for(const key of ['caption','storyTitle','visualDescription']){
      const next=personalizeText(photo[key],state);if(next!==photo[key]){photo[key]=next;changed=true;}
    }
    if(changed)report.photos++;
  }
  for(const memory of state.memories||[])if(memory.type==='trip') {
    const text=personalizeText(memory.text,state);if(text!==memory.text){memory.text=text;report.memories++;}
  }
  const tripPhotoIds=new Set((state.photos||[]).filter(p=>p.kind==='trip').map(p=>p.id));
  for(const message of state.chatArchive||[])if(message.role==='assistant'&&(message.tripDate||message.photoIds?.some(id=>tripPhotoIds.has(id))||tripPhotoIds.has(message.referencePhotoId))) {
    const text=personalizeText(message.content,state);if(text!==message.content){message.content=text;report.announcements++;}
  }
  return report;
}
module.exports={migrateTravelNames};
