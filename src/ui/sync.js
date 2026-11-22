  /* Synchronisation entre appareils (5.1.0) : connexion Google et copie des données dans Firestore (projet Firebase de
     l'appli), users/{uid}/e/{id} = { v: JSON | null, t: heure de la modification (ms), s: heure du serveur }. Les règles du
     projet ne laissent chaque compte lire et écrire que son espace. La bibliothèque officielle (app, auth, firestore-lite,
     FB_VERSION) n'est chargée que si la synchronisation est utilisée ; sans elle, l'appli marche comme avant.
     Le découpage et la fusion sont dans engine/sync.js. Les changements venus d'un autre appareil ne sont écrits que quand
     rien n'est en cours ici (pas d'assistant, de formulaire des repas, de panneau ouvert, ni d'accueil refait), puis la
     page se recharge : l'état en mémoire ne peut pas les écraser.
     Pour les tests : window.__repasSync = { adapter, reload, delay } remplace Firebase, le rechargement et le délai. */
  const FB_VERSION = '12.19.0';
  const FB_CONFIG = {apiKey:'AIzaSyCFPLXWigZeEK4EFoejWKwqexEBKXaGSJA', authDomain:'nutriplan-a9b42.firebaseapp.com', projectId:'nutriplan-a9b42',
    storageBucket:'nutriplan-a9b42.firebasestorage.app', messagingSenderId:'336973795535', appId:'1:336973795535:web:48be16bbe0db54577c27ba'};
  const FLASH_KEY = 'repas-du-jour:sync-flash';
  const syncHooks = window.__repasSync || null;
  let syncMeta = cleanSyncMeta(readObj(SYNC_KEY));
  const saveSync = function(){ try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncMeta)); } catch (e) {} };
  const rawStores = function(){
    const o = {};
    Object.keys(SYNC_STORES).forEach(function(k){ try { o[k] = localStorage.getItem(SYNC_STORES[k]); } catch (e) { o[k] = null; } });
    return o;
  };
  /* Les changements de cet appareil, datés (hors connexion aussi : ils gardent leur heure pour la prochaine synchronisation) */
  const syncLocal = function(){ const sp = syncSplit(rawStores()); syncDiff(sp, syncMeta, Date.now()); saveSync(); return sp; };
  /* Rien en cours qui serait perdu par un rechargement */
  const syncIdle = function(){
    const open = stack.some(function(x){ return x.name === 'wiz' || x.name === 'repas'; });
    let accBusy = false;
    try { accBusy = !!acc && localStorage.getItem(PKEY) !== null; } catch (e) {}
    return !open && $('sheet').hidden && !accBusy;
  };
  const reloadPage = function(){ if (syncHooks && syncHooks.reload) syncHooks.reload(); else location.reload(); };

  /* Firebase, chargé une fois. Interface : onUser(cb), signIn(), signOut(), pull(uid, depuis), push(uid, entrées), wipe(uid) */
  let fbP = null;
  const fbAdapter = function(){
    if (syncHooks && syncHooks.adapter) return Promise.resolve(syncHooks.adapter);
    if (fbP) return fbP;
    const url = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/firebase-';
    fbP = Promise.all([import(url + 'app.js'), import(url + 'auth.js'), import(url + 'firestore-lite.js')]).then(function(m){
      const app = m[0].initializeApp(FB_CONFIG), A = m[1], F = m[2], auth = A.getAuth(app), db = F.getFirestore(app);
      const col = function(uid){ return F.collection(db, 'users', uid, 'e'); };
      const inBatches = function(list, fn){
        let p = Promise.resolve();
        for (let i = 0; i < list.length; i += 400){
          const part = list.slice(i, i + 400);
          p = p.then(function(){ const b = F.writeBatch(db); part.forEach(function(x){ fn(b, x); }); return b.commit(); });
        }
        return p;
      };
      return {
        onUser:function(cb){ A.onAuthStateChanged(auth, function(u){ cb(u ? {uid:u.uid, email:u.email || ''} : null); }); A.getRedirectResult(auth).catch(function(){}); },
        signIn:function(){
          const pv = new A.GoogleAuthProvider();
          return A.signInWithPopup(auth, pv).catch(function(e){
            if (e && /popup-blocked|operation-not-supported/.test(e.code || '')) return A.signInWithRedirect(auth, pv);
            throw e;
          });
        },
        signOut:function(){ return A.signOut(auth); },
        pull:function(uid, since){
          const q = since ? F.query(col(uid), F.where('s', '>', F.Timestamp.fromMillis(since))) : col(uid);
          return F.getDocs(q).then(function(snap){
            return snap.docs.map(function(d){
              const x = d.data();
              return {id:d.id, v:typeof x.v === 'string' ? x.v : null, t:typeof x.t === 'number' ? x.t : 0, s:x.s && x.s.toMillis ? x.s.toMillis() : 0};
            });
          });
        },
        push:function(uid, list){ return inBatches(list, function(b, x){ b.set(F.doc(col(uid), x.id), {v:x.v, t:x.t, s:F.serverTimestamp()}); }); },
        wipe:function(uid){ return F.getDocs(col(uid)).then(function(snap){ return inBatches(snap.docs, function(b, d){ b.delete(d.ref); }); }); }
      };
    });
    fbP.catch(function(){ fbP = null; });
    return fbP;
  };

  /* État affiché : off (pas connecté), wait (chargement, connexion), on ; msg : la dernière erreur */
  const sync = {user:null, state:'off', msg:'', busy:null, again:false, listening:false, timer:null, held:false};
  const errText = function(e){
    const c = (e && e.code) || '';
    if (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(c)) return 'Connexion annulée.';
    if (/network-request-failed|unavailable/.test(c) || !c) return 'Pas de réseau, ou Google ne répond pas' + NB + ': réessaie plus tard.';
    if (/unauthorized-domain/.test(c)) return 'Ce site n’est pas autorisé dans le projet Firebase de l’appli.';
    if (/web-storage-unsupported|operation-not-supported/.test(c)) return 'Ce navigateur bloque la connexion Google' + NB + ': essaie dans Safari ou Chrome.';
    if (/internal-error/.test(c)) return 'La connexion à Google n’a pas marché' + NB + ': un bloqueur de publicités ou de traceurs peut l’empêcher (il bloque apis.google.com).';
    if (/permission-denied/.test(c)) return 'Ta copie en ligne est refusée par le serveur (' + c + ').';
    return 'La synchronisation n’a pas marché (' + c + ').';
  };
  const whenText = function(ms){
    const d = new Date(ms), dd = Math.round((noon() - new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)) / 864e5);
    const h = d.getHours() + NB + 'h' + NB + String(d.getMinutes()).padStart(2, '0');
    return (dd === 0 ? 'aujourd’hui' : dd === 1 ? 'hier' : 'le ' + dayLabel(d).replace(/^\S+ /, '')) + ' à ' + h;
  };
  const renderSync = function(){
    const on = sync.state === 'on' && sync.user;
    $('sync-s').textContent = on ? 'Tes jours, ton profil, tes planifications et tes repas cochés sont copiés sur ton compte, et repris sur tes autres appareils.'
      : 'Retrouve tes jours, ton profil, tes planifications et tes repas cochés sur tous tes appareils, avec ton compte Google. Ils sont copiés dans le projet Firebase de l’appli' + NB + ': son administrateur peut techniquement y accéder.';
    $('sync-st').textContent = sync.state === 'wait' ? 'Connexion…' : on ? 'Connecté avec ' + (sync.user.email || 'ton compte Google') + '.' +
      (sync.busy ? ' Synchronisation…' : syncMeta.at ? ' Dernière synchronisation' + NB + ': ' + whenText(syncMeta.at) + '.' : '') +
      (sync.held ? ' Des changements de ton autre appareil arrivent dès que tu reviens à ta journée.' : '') : '';
    $('sync-acts').innerHTML = on
      ? '<button type="button" class="reset" id="sync-now" data-action="sync-now">Synchroniser maintenant</button><button type="button" class="reset" id="sync-out" data-action="sync-out">Se déconnecter</button>'
      : '<button type="button" class="btn" id="sync-in" data-action="sync-in"' + (sync.state === 'wait' ? ' disabled' : '') + '>Se connecter avec Google</button>';
    $('sync-err').textContent = sync.msg;
    $('acc-sync-msg').textContent = sync.state === 'wait' ? 'Connexion…' : sync.msg;
    $('eff-sync').hidden = !on;
  };
  /* Une synchronisation : les changements d'ici datés, ce qui a changé en ligne depuis la dernière fois (tout, la première
     fois sur ce compte : la copie en ligne l'emporte), envoi de ce qui est plus récent ici, puis écriture de ce qui vient
     d'ailleurs et rechargement (seulement si rien n'est en cours, sinon ce sera la prochaine fois). */
  const syncCycle = function(a){
    const u = sync.user, first = syncMeta.uid !== u.uid;
    syncLocal();
    return a.pull(u.uid, first ? 0 : syncMeta.last).then(function(remote){
      const meta = cleanSyncMeta(JSON.parse(JSON.stringify(syncMeta)));
      const split = syncSplit(rawStores());
      syncDiff(split, meta, Date.now());
      const m = syncMerge(split, meta, Array.isArray(remote) ? remote : [], first);
      const n = Object.keys(m.apply).length;
      if (n && !syncIdle()){ sync.held = true; return; }
      return (m.push.length ? a.push(u.uid, m.push) : Promise.resolve()).then(function(){
        m.push.forEach(function(x){ const i = meta.dirty.indexOf(x.id); if (i >= 0) meta.dirty.splice(i, 1); });
        meta.uid = u.uid; meta.email = u.email; meta.at = Date.now(); meta.pending = false;
        if (n && !syncIdle()){
          /* Devenu occupé pendant l'envoi : ce qui vient d'ailleurs attendra (relu la prochaine fois) */
          meta.last = syncMeta.last;
          Object.keys(m.apply).forEach(function(id){ delete meta.t[id]; delete meta.seen[id]; if (has(syncMeta.t, id)) meta.t[id] = syncMeta.t[id]; if (has(syncMeta.seen, id)) meta.seen[id] = syncMeta.seen[id]; });
          if (first) meta.uid = syncMeta.uid;
          syncMeta = meta; saveSync(); sync.held = true;
          return;
        }
        sync.held = false;
        if (n){
          const out = syncJoin(rawStores(), m.apply);
          try { Object.keys(out).forEach(function(k){ if (out[k] === null) localStorage.removeItem(SYNC_STORES[k]); else localStorage.setItem(SYNC_STORES[k], out[k]); }); } catch (e) {}
        }
        syncMeta = meta; saveSync();
        if (n){
          try { sessionStorage.setItem(FLASH_KEY, '1'); } catch (e) {}
          reloadPage();
        }
      });
    });
  };
  const syncRun = function(){
    if (!sync.user || sync.state !== 'on'){ syncLocal(); return Promise.resolve(); }
    if (sync.busy){ sync.again = true; return sync.busy; }
    sync.busy = fbAdapter().then(syncCycle).then(function(){ sync.msg = ''; }, function(e){ sync.msg = errText(e); }).then(function(){
      sync.busy = null;
      renderSync();
      if (sync.again){ sync.again = false; return syncRun(); }
    });
    renderSync();
    return sync.busy;
  };
  /* Quelques secondes après un changement (les clics s'enchaînent) */
  const syncSoon = function(ms){
    clearTimeout(sync.timer);
    sync.timer = setTimeout(syncRun, ms !== undefined ? ms : syncHooks && syncHooks.delay !== undefined ? syncHooks.delay : 3000);
  };
  /* Compte connecté ou non (aussi au retour d'une connexion par redirection, ou après une session expirée) */
  const syncListen = function(a){
    if (sync.listening) return;
    sync.listening = true;
    a.onUser(function(u){
      sync.user = u;
      sync.state = u ? 'on' : 'off';
      syncMeta.on = !!u; if (u) syncMeta.pending = false; saveSync();
      if (u) syncRun();
      renderSync();
    });
  };
  const syncStart = function(){
    sync.state = 'wait'; sync.msg = ''; renderSync();
    return fbAdapter().then(function(a){ syncListen(a); return a; }, function(e){ sync.state = 'off'; sync.msg = errText(e); renderSync(); throw e; });
  };
  Object.assign(ACTIONS, {
    'sync-in': function(){
      if (sync.state === 'wait') return;
      syncMeta.pending = true; saveSync();
      syncStart().then(function(a){
        sync.state = 'wait'; renderSync();
        return a.signIn();
      }).then(function(){ renderSync(); }, function(e){
        syncMeta.pending = false; saveSync();
        sync.state = sync.user ? 'on' : 'off'; sync.msg = errText(e); renderSync();
      });
    },
    'sync-out': function(){
      fbAdapter().then(function(a){ return a.signOut(); }).then(function(){
        sync.user = null; sync.state = 'off'; sync.msg = ''; syncMeta.on = false; saveSync(); renderSync();
        $('sync-st').textContent = 'Déconnecté. Tes données restent sur cet appareil.';
        $('sync-in').focus({preventScroll:true});
      }, function(e){ sync.msg = errText(e); renderSync(); });
    },
    'sync-now': function(){ clearTimeout(sync.timer); syncRun(); },
    /* Tout effacer : connecté, la copie en ligne d'abord (sinon rien n'est effacé), puis la déconnexion et l'appareil */
    'eff-ok': function(){
      if (!sync.user){ resetAll(); syncMeta = cleanSyncMeta(null); return; }
      const u = sync.user;
      $('eff-msg').textContent = 'Effacement de ta copie en ligne…';
      fbAdapter().then(function(a){ return a.wipe(u.uid).then(function(){ return a.signOut(); }); }).then(function(){
        sync.user = null; sync.state = 'off'; $('eff-msg').textContent = '';
        resetAll();
        syncMeta = cleanSyncMeta(null); renderSync();
      }, function(e){ $('eff-msg').textContent = 'Ta copie en ligne n’a pas pu être effacée' + NB + ': ' + errText(e).charAt(0).toLowerCase() + errText(e).slice(1) + ' Rien n’a été effacé.'; });
    }
  });
  document.addEventListener('click', function(){ syncSoon(); });
  document.addEventListener('change', function(){ syncSoon(); });
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden'){ clearTimeout(sync.timer); syncRun(); } else syncSoon(500); });
  renderSync();
  /* Déjà connecté sur cet appareil (ou de retour d'une connexion par redirection) : la bibliothèque est chargée tout de suite */
  if (syncMeta.on || syncMeta.pending) syncStart().catch(function(){});
  else syncLocal();
  try { if (sessionStorage.getItem(FLASH_KEY)){ sessionStorage.removeItem(FLASH_KEY); $('hint').textContent = 'Tes données sont à jour avec tes autres appareils.'; } } catch (e) {}
