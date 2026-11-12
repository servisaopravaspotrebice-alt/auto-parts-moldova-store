(function(){const lines={ro:['Sună consultantul','Sau scrie-ne într-un mesaj'],ru:['Позвонить консультанту','Или напишите нам в мессенджер'],uk:['Зателефонувати консультанту','Або напишіть нам у месенджер'],en:['Call our consultant','Or message us']};function apply(){const lang=(document.querySelector('#language')?.value||document.documentElement.lang||'ro').toLowerCase();const t=lines[lang]||lines.ro;document.querySelector('[data-contact-text="call"]')?.replaceChildren(document.createTextNode(t[0]));document.querySelector('[data-contact-text="messengers"]')?.replaceChildren(document.createTextNode(t[1]));}document.addEventListener('DOMContentLoaded',()=>{apply();document.querySelector('#language')?.addEventListener('change',apply)});})();

/* Compact in-form phone and messenger actions */
(function(){
const copy={
 ro:{call:"SUNĂ CONSULTANTUL",write:"Sau scrie-ne",wa:"WhatsApp",viber:"Viber"},
 ru:{call:"ПОЗВОНИТЬ КОНСУЛЬТАНТУ",write:"Или напишите нам",wa:"WhatsApp",viber:"Viber"},
 uk:{call:"ЗАТЕЛЕФОНУВАТИ КОНСУЛЬТАНТУ",write:"Або напишіть нам",wa:"WhatsApp",viber:"Viber"},
 en:{call:"CALL OUR CONSULTANT",write:"Or message us",wa:"WhatsApp",viber:"Viber"}
};
function ready(){
 const head=document.querySelector(".conversion-form-frame .conversion-form-heading");
 if(!head||document.querySelector(".form-contact-compact"))return;
 const block=document.createElement("div");
 block.className="form-contact-compact";
 block.setAttribute("aria-label","Contact our consultant");
 block.innerHTML='<a class="form-contact-phone" href="tel:+37368712418" aria-label="Call +373 687 12 418"><span class="form-contact-phone-icon" aria-hidden="true">☎</span><span class="form-contact-phone-copy"><small class="form-contact-call-label">CALL OUR CONSULTANT</small><strong>+373 687 12 418</strong></span></a><div class="form-contact-or"></div><div class="form-contact-messengers"><a class="form-contact-chat" href="https://wa.me/37368712418" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><img src="https://cdn.simpleicons.org/whatsapp/25D366" alt="" width="23" height="23" loading="lazy"><span>WhatsApp</span></a><a class="form-contact-chat" href="viber://chat?number=%2B37368712418" aria-label="Viber"><img src="https://cdn.simpleicons.org/viber/7360F2" alt="" width="23" height="23" loading="lazy"><span>Viber</span></a></div>';
 head.insertAdjacentElement("afterend",block);
 const lang=document.getElementById("language");
 function translate(){
  const code=(lang?.value||document.documentElement.lang||"ro").toLowerCase();
  const t=copy[code]||copy.ro;
  block.querySelector(".form-contact-call-label").textContent=t.call;
  block.querySelector(".form-contact-or").textContent=t.write;
 }
 translate();
 lang?.addEventListener("change",translate);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();
