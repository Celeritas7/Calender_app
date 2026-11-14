/* Calendar sources share Akatsuki's push subscriptions and broadcast delivery. */
(() => {
  const $ = id => document.getElementById(id);
  let owner = null;
  let busy = false;
  let settingsLoaded = false;
  const defaults = {birthday_enabled:false,birthday_time:'08:00',birthday_days_before:0,rain_enabled:false,rain_time:'07:00',weather_key:'plan',rain_mm:2,timezone:'Asia/Tokyo'};
  function message(text) { $('alert-message').textContent = text; }
  function signedIn() { if (GUEST || !UID || UID !== owner) throw new Error('Sign in to configure notifications.'); }
  async function run(fn) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('#alert-ov button[data-action]').forEach(b => b.disabled = true);
    try { signedIn(); await fn(); } catch(e) { message(e.message || String(e)); }
    finally { busy = false; document.querySelectorAll('#alert-ov button[data-action]').forEach(b => b.disabled = b.id === 'alert-save' && !settingsLoaded); }
  }
  function supported() {
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator))
      throw new Error('Web Push is unavailable here. On iPad/iPhone, install Calendar on the Home Screen and open it there.');
  }
  async function registration() {
    supported();
    const reg = await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);
    if (!reg || !reg.active || reg.scope !== new URL('./',location.href).href) throw new Error('Calendar is updating. Reload once, then try again.');
    return reg;
  }
  async function deviceStatus() {
    try {
      const reg = await registration(), sub = await reg.pushManager.getSubscription();
      if (!sub) { $('alert-device').textContent = 'This Calendar installation: notifications off.'; return; }
      const {data,error} = await sb.from('akatsuki_push_subscriptions').select('id').eq('endpoint',sub.endpoint).maybeSingle();
      if(error) throw error;
      $('alert-device').textContent = data && Notification.permission==='granted' ? 'This Calendar installation: registered for Akatsuki notifications.' : 'This installation is not registered for your account. Tap Enable.';
    } catch(e) { $('alert-device').textContent = e.message; }
  }
  window.openCalendarAlerts = async () => {
    owner = UID;
    settingsLoaded = false;
    $('alert-ov').classList.remove('hidden');
    message('Loading settings…');
    $('alert-save').disabled = true;
    try {
      signedIn();
      if(!navigator.onLine) throw new Error('Connect to the internet to load or change notification settings. Your calendar remains available offline.');
      const openingOwner = owner;
      const [prefs,wx] = await Promise.all([
        sb.from('calendar_alert_preferences').select('*').eq('user_id',owner).maybeSingle(),
        sb.from('akatsuki_weather').select('key,label,fetched_at').eq('user_id',owner)
      ]);
      if (prefs.error) throw prefs.error;
      if (wx.error) throw wx.error;
      if (openingOwner!==UID) return;
      const p = {...defaults,...prefs.data};
      $('alert-birthday').checked = p.birthday_enabled;
      $('alert-birthday-time').value = p.birthday_time.slice(0,5);
      $('alert-before').value = p.birthday_days_before;
      $('alert-rain').checked = p.rain_enabled;
      $('alert-rain-time').value = p.rain_time.slice(0,5);
      $('alert-mm').value = p.rain_mm;
      const select = $('alert-place'); select.replaceChildren();
      const rows = wx.data || [];
      if(!rows.some(r=>r.key===p.weather_key)) rows.unshift({key:p.weather_key,label:'Saved location (fresh forecast unavailable)'});
      for (const row of rows) { const option=document.createElement('option'); option.value=row.key; option.textContent=row.label || row.key; select.appendChild(option); }
      select.value=p.weather_key;
      settingsLoaded = true;
      $('alert-save').disabled=false;
      message('Settings loaded. All times are Japan time.');
      await deviceStatus();
    } catch(e) {message(e.message || String(e));}
  };
  window.closeCalendarAlerts = () => { $('alert-ov').classList.add('hidden'); };
  window.saveCalendarAlerts = () => run(async () => {
    if (!settingsLoaded) throw new Error('Load settings successfully before saving.');
    if (!$('alert-form').reportValidity()) return;
    const row = {user_id:owner,timezone:'Asia/Tokyo',birthday_enabled:$('alert-birthday').checked,
      birthday_time:$('alert-birthday-time').value,birthday_days_before:Number($('alert-before').value),
      rain_enabled:$('alert-rain').checked,rain_time:$('alert-rain-time').value,
      rain_mm:Number($('alert-mm').value),weather_key:$('alert-place').value};
    const {error} = await sb.from('calendar_alert_preferences').upsert(row,{onConflict:'user_id'});
    if(error) throw error;
    message('Saved. Akatsuki checks every minute, even when Calendar is closed. Enable this device to receive pushes.');
  });
  window.enableCalendarPush = () => {
    // Request directly inside the tap: iOS requires user activation.
    try { signedIn(); supported(); } catch(e) {message(e.message);return;}
    const permission = Notification.requestPermission();
    return run(async () => {
      if(await permission !== 'granted') throw new Error('Permission was not granted. Allow Calendar notifications in your device/browser settings.');
      const reg=await registration();
      const {data:key,error}=await sb.rpc('akatsuki_vapid_public');
      if(error) throw error;
      if(!key) throw new Error('Push key is unavailable. Try again later.');
      const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const sub=await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      signedIn();
      const j=sub.toJSON();
      const result=await sb.rpc('akatsuki_push_subscribe',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_device:'Calendar · '+(/Android/.test(navigator.userAgent)?'Android':/iPad|iPhone|Macintosh/.test(navigator.userAgent)?'Apple':'Desktop')});
      if(result.error) throw result.error;
      message('Device enabled. Use Test to verify delivery. Existing Akatsuki subscriptions on other installations remain active.');
      await deviceStatus();
    });
  };
  window.disableCalendarPush = () => run(async () => {
    const reg=await registration(),sub=await reg.pushManager.getSubscription();
    if(sub) {
      const {error}=await sb.from('akatsuki_push_subscriptions').delete().eq('endpoint',sub.endpoint);
      if(error) throw error;
      if(!await sub.unsubscribe()) throw new Error('Server registration removed; browser subscription could not be removed. Try again.');
    }
    message('Notifications off for this Calendar installation. Other registered devices remain enabled.');
    await deviceStatus();
  });
  window.testCalendarPush = () => run(async () => {
    const {data,error}=await sb.functions.invoke('akatsuki-broadcast-push',{body:{test:true}});
    if(error) throw error;
    if(!data?.delivered) throw new Error('No device accepted the test. Enable this device and try again.');
    message(`Push service accepted the test for ${data.delivered} of ${data.devices} registered device(s). Check your notifications.`);
  });
})();
