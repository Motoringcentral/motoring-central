
function show(i,b){document.querySelectorAll('.s').forEach(function(s,k){s.classList.toggle('on',k===i)});document.querySelectorAll('#s'+i+' [data-b]').forEach(function(e){var u=e.getAttribute('data-u');e.style.visibility=(+e.getAttribute('data-b')<=b&&(u==null||b<=+u))?'visible':'hidden'})}
function builds(i){var m=0;document.querySelectorAll('#s'+i+' [data-b]').forEach(function(e){m=Math.max(m,+e.getAttribute('data-b'))});return m}
