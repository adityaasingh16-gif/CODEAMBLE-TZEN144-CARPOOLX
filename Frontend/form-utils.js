(function(window){
  const FormUtils = {};

  // Simple validators
  FormUtils.validators = {
    required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
    minLength: (len) => (v) => String(v || '').trim().length >= len,
    email: (v) => /^\S+@\S+\.\S+$/.test((v||'').trim()),
    phone10: (v) => /^\d{10}$/.test((v||'').replace(/\D/g,'')),
    aadhaar: (v) => /^\d{12}$/.test((v||'').replace(/\D/g,'')),
    pan: (v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((v||'').toUpperCase()),
    passingNo: (v) => /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/i.test((v||'').replace(/\s+/g,''))
  };

  // Inject minimal styles for errors (does not change theme variables)
  (function injectStyles(){
    const css = `
      .input-error-text{display:block;margin-top:6px;font-size:0.82rem;color:#E53935}
      .input-success{outline:2px solid rgba(76,175,80,0.08)}
      .input-error{outline:2px solid rgba(229,57,53,0.15)}
    `;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  })();

  // Utility: show error under input
  FormUtils.setError = function(input, message){
    if(!input) return;
    input.classList.remove('input-success');
    input.classList.add('input-error');
    let id = input.getAttribute('aria-describedby');
    let err;
    if (id) err = document.getElementById(id);
    if (!err) {
      err = document.createElement('div');
      err.className = 'input-error-text';
      const genId = 'err-'+(input.id||Math.random().toString(36).slice(2,8));
      err.id = genId;
      input.setAttribute('aria-describedby', genId);
      input.insertAdjacentElement('afterend', err);
    }
    err.textContent = message;
    err.setAttribute('role','alert');
  };

  FormUtils.clearError = function(input){
    if(!input) return;
    input.classList.remove('input-error');
    input.classList.add('input-success');
    const id = input.getAttribute('aria-describedby');
    if (id) {
      const el = document.getElementById(id);
      if (el) el.remove();
      input.removeAttribute('aria-describedby');
    }
  };

  // Format phone number (simple grouping): if starts with +, keep; otherwise format 5-5: 98765 43210
  FormUtils.formatPhone = function(value){
    if (!value) return '';
    const digits = value.replace(/\D/g,'');
    if (digits.length <= 5) return digits;
    if (digits.length <= 10) return digits.slice(0,5) + (digits.length>5? ' ' + digits.slice(5):'');
    // more than 10, show country prefix + rest
    return digits.slice(0, digits.length-10) + ' ' + digits.slice(-10, -5) + ' ' + digits.slice(-5);
  };

  FormUtils.attachPhoneMask = function(input){
    if(!input) return;
    input.addEventListener('input', (e)=>{
      const pos = input.selectionStart;
      const raw = input.value;
      const formatted = FormUtils.formatPhone(raw);
      input.value = formatted;
      // try to keep cursor at end
      input.selectionStart = input.selectionEnd = input.value.length;
    });
  };

  // Attach validation to a form with a rules map: { fieldId: [ { test: fn, message } ] }
  FormUtils.attachValidation = function(form, rules){
    if(!form || !rules) return;
    // on input and blur
    Object.keys(rules).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      const fieldRules = rules[fieldId];
      const validate = ()=>{
        for (const r of fieldRules){
          const ok = (typeof r.test === 'function') ? r.test(field.value) : !!r.test;
          if (!ok) { FormUtils.setError(field, r.message); return false; }
        }
        FormUtils.clearError(field);
        return true;
      };
      field.addEventListener('blur', validate);
      field.addEventListener('input', ()=>{
        // optimistic clear if passes
        for (const r of fieldRules){
          const ok = (typeof r.test === 'function') ? r.test(field.value) : !!r.test;
          if (!ok) { FormUtils.clearError(field); return; }
        }
        FormUtils.clearError(field);
      });
    });

    form.addEventListener('submit', (e)=>{
      let firstInvalid = null;
      Object.keys(rules).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        const fieldRules = rules[fieldId];
        for (const r of fieldRules){
          const ok = (typeof r.test === 'function') ? r.test(field.value) : !!r.test;
          if (!ok) { FormUtils.setError(field, r.message); if (!firstInvalid) firstInvalid = field; break; }
        }
      });
      if (firstInvalid) {
        e.preventDefault();
        try { firstInvalid.focus(); } catch(_) {}
      }
    });
  };

  // Programmatic validation helper for arbitrary rules
  FormUtils.validateRules = function(rules){
    // rules: { fieldId: [ { test, message } ] }
    let ok = true;
    let firstInvalid = null;
    Object.keys(rules).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      for (const r of rules[fieldId]){
        const pass = (typeof r.test === 'function') ? r.test(field.value) : !!r.test;
        if (!pass) { FormUtils.setError(field, r.message); if (!firstInvalid) firstInvalid = field; ok = false; break; }
        else FormUtils.clearError(field);
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return ok;
  };

  window.FormUtils = FormUtils;
})(window);
