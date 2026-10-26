import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const ADMIN_ID=7545540622;
export const ADMIN_IDS=[7545540622,812392131];
export const welcome='Говорят, Фортуна — дама капризная, но перед блеском дерзких глаз она всегда снимает вуаль 🤩\n\nДобро пожаловать! Пусть ваш сегодняшний вечер будет отмечен золотой печатью удачи и успеха.\n\nИспытайте удачу и узнайте, какой подарок приготовила для вас «Дубровка». Нажмите «Испытать удачу» — и пусть этот вечер станет особенным! 🥂🎩';
export function keyboard(url){return {inline_keyboard:[[{text:'🎡 Испытать удачу',web_app:{url}}]]};}
const instructions='Отправьте сюда фото чека от 5 000 ₽ из нашего заведения. Администратор проверит чек и после одобрения начислит один дополнительный прокрут.';
export async function handle(update,api,url,internal){
 const q=update.callback_query;
 if(q){
  if(/^(approve|reject):/.test(q.data||'')){
   if(!ADMIN_IDS.includes(q.from.id)||q.message?.chat.id!==q.from.id){await api('answerCallbackQuery',{callback_query_id:q.id,text:'Доступ только администратору',show_alert:true});return;}
   await api('answerCallbackQuery',{callback_query_id:q.id,text:'Проверяю решение…'});
   const [action,id]=q.data.split(':');const result=await internal('/internal/decision',{adminId:q.from.id,receiptId:Number(id),action});
   const text=result.missing?'Чек не найден':result.status==='approved'?'✅ Чек №'+id+' одобрен. Один прокрут начислен.':'❌ Чек №'+id+' отклонён.';
   await api('editMessageReplyMarkup',{chat_id:m.from.id,message_id:q.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
   await api('sendMessage',{chat_id:m.from.id,text:(result.alreadyDecided?'Решение уже сохранено. ':'')+text});return;
  }
  await api('answerCallbackQuery',{callback_query_id:q.id});
  if(['receipt','rules'].includes(q.data)&&q.message?.chat.type==='private')await api('sendMessage',{chat_id:q.from.id,text:instructions});return;
 }
 const m=update.message;if(!m||m.chat.type!=='private')return;
 const command=(m.text||'').split(/\s/)[0].split('@')[0];
 if(command==='/admin'){
  if(!ADMIN_IDS.includes(m.from.id)){await api('sendMessage',{chat_id:m.chat.id,text:'Раздел доступен только администратору.'});return;}
  const list=await internal('/internal/pending',{adminId:m.from.id});
  if(!list.receipts.length)await api('sendMessage',{chat_id:m.from.id,text:'Новых чеков на проверке нет.'});
  for(const row of list.receipts)await api(row.method,row.payload);return;
 }
 if(command==='/receipt'){await api('sendMessage',{chat_id:m.chat.id,text:instructions});return;}
 const media=m.photo?.at(-1)||m.document;
 if(media){
  if(m.document&&!['application/pdf','image/jpeg','image/png','image/webp'].includes(m.document.mime_type)){await api('sendMessage',{chat_id:m.chat.id,text:'Отправьте фото чека или PDF.'});return;}
  if((media.file_size||0)>10*1024*1024){await api('sendMessage',{chat_id:m.chat.id,text:'Файл слишком большой. Максимальный размер — 10 МБ.'});return;}
  const result=await internal('/internal/receipt',{userId:m.from.id,fileId:media.file_id,fileUniqueId:media.file_unique_id,kind:m.photo?'photo':'document',caption:m.caption||''});
  await api('sendMessage',{chat_id:m.chat.id,text:result.duplicate?'Этот файл уже был отправлен. Повторно зачесть один и тот же чек нельзя.':result.pending?'Ваш чек №'+result.id+' уже ожидает проверки. Дождитесь решения администратора.':'Чек №'+result.id+' принят на проверку ✅ После одобрения начислим один прокрут.'});return;
 }
 await api('sendMessage',{chat_id:m.chat.id,text:['/start','/wheel','/help'].includes(command)?welcome:'Откройте колесо по кнопке или отправьте фото / PDF чека от 5 000 ₽.',reply_markup:keyboard(url)});
 if(command==='/start'&&ADMIN_IDS.includes(m.from.id))await api('sendMessage',{chat_id:m.from.id,text:'Вы — администратор. Новые чеки будут приходить сюда с кнопками одобрения и отклонения. Команда /admin показывает до 10 ожидающих чеков.'});
}

export async function main(){
 const config=JSON.parse(await readFile(new URL('./config.json',import.meta.url),'utf8'));
 const token=config.token.trim(),miniAppUrl=config.miniAppUrl;
 async function internal(path,body={}){const res=await fetch(miniAppUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+createHash('sha256').update('wheel-notifications:'+token).digest('hex')},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error('Сервер временно недоступен');return res.json();}
 let address;try{address=new URL(miniAppUrl)}catch{throw new Error('Укажите адрес мини-приложения в config.json')}
 if(!token||token==='PASTE_BOT_TOKEN_HERE')throw new Error('Добавьте токен в config.json');
 if(address.protocol!=='https:'||['localhost','127.0.0.1','example.com'].includes(address.hostname))throw new Error('Нужен публичный HTTPS-адрес колеса');
 async function api(method,body={}){
  const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!data.ok){const error=new Error('Ошибка Telegram API: '+data.error_code);error.code=data.error_code;error.delay=data.parameters?.retry_after;throw error;}return data.result;
 }
 await api('getMe');const hook=await api('getWebhookInfo');if(hook.url)throw new Error('У бота уже настроен webhook. Используйте отдельного бота или отключите webhook перед запуском.');
 await api('setMyCommands',{commands:[{command:'start',description:'Открыть колесо фортуны'},{command:'wheel',description:'Испытать удачу'},{command:'help',description:'Как участвовать'},{command:'receipt',description:'Отправить чек'},{command:'admin',description:'Проверка чеков (администратор)'}]});
 console.log('Бот запущен. Для остановки нажмите Ctrl+C.');let offset=0;
 while(true){try{await fetch(miniAppUrl.replace(/\/$/,'')+'/internal/notify',{method:'POST',headers:{authorization:'Bearer '+createHash('sha256').update('wheel-notifications:'+token.trim()).digest('hex')},signal:AbortSignal.timeout(20000)}).catch(()=>{});const updates=await api('getUpdates',{offset,timeout:30,allowed_updates:['message','callback_query']});for(const update of updates){try{await handle(update,api,miniAppUrl,internal)}catch(error){if(error.code!==403)throw error}offset=update.update_id+1;}}catch(error){if([401,409].includes(error.code))throw new Error('Проверьте токен и убедитесь, что запущена только одна копия бота.');console.error('Нет связи с Telegram или временная ошибка. Повторяем запрос.');await new Promise(resolve=>setTimeout(resolve,(error.delay||5)*1000));}}
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message.includes('fetch')?'Не удалось подключиться к Telegram.':error.message);process.exitCode=1});
