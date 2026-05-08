
let files = [];

//file input & drag-and-drop
document.getElementById("fileIn").onchange = (e) =>
  addFiles([...e.target.files]);

const dz = document.getElementById("dropZone");
dz.ondragover = (e) => {
  e.preventDefault();
  dz.classList.add("over");
};
dz.ondragleave = () => dz.classList.remove("over");
dz.ondrop = (e) => {
  e.preventDefault();
  dz.classList.remove("over");
  addFiles(
    [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")),
  );
};

//add files
function addFiles(newFiles) {
  newFiles.forEach((f) => {
    if (!files.find((x) => x.name === f.name && x.size === f.size))
      files.push(f);
  });
  render();
}

//remove a file
function del(i) {
  files.splice(i, 1);
  render();
}

//format file size
function fmt(bytes) {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + " KB"
    : (bytes / 1024 / 1024).toFixed(1) + " MB";
}

//render ui
function render() {
  const fl = document.getElementById("fileList");
  const qs = document.getElementById("queueSection");
  const pg = document.getElementById("previewGrid");
  const es = document.getElementById("emptyState");

  // rebuild sidebar file list
  fl.innerHTML = "";
  files.forEach((f, i) => {
    const d = document.createElement("div");
    d.className = "file-item";
    d.innerHTML = `
                    <span class="name" title="${f.name}">${f.name}</span>
                    <span class="size">${fmt(f.size)}</span>
                    <span class="rm" onclick="del(${i})">✕</span>`;
    fl.appendChild(d);
  });

  document.getElementById("qCount").textContent = files.length;
  qs.style.display = files.length ? "block" : "none";
  document.getElementById("runBtn").disabled = files.length === 0;

  // rebuild preview grid
  pg.innerHTML = "";
  if (!files.length) {
    es.style.display = "flex";
    return;
  }
  es.style.display = "none";

  files.forEach((f) => {
    const card = document.createElement("div");
    card.className = "preview-card";
    card.id = "card-" + f.name;

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = URL.createObjectURL(f);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `
                    <div class="fname">${f.name}</div>
                    <span class="status">queued</span>`;

    card.appendChild(img);
    card.appendChild(meta);
    pg.appendChild(card);
  });
}

//log
function log(html) {
  const lb = document.getElementById("logBox");
  lb.style.display = "block";
  const ts = new Date().toLocaleTimeString();
  lb.innerHTML += `<span class="ts">[${ts}]</span> ${html}<br>`;
  lb.scrollTop = lb.scrollHeight;
}

//Sharpen
function sharpenPixels(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0]; 

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            s +=
              data[((y + ky) * width + (x + kx)) * 4 + c] *
              k[(ky + 1) * 3 + (kx + 1)];
        out[i + c] = Math.max(0, Math.min(255, s)); 
      }
      out[i + 3] = data[i + 3]; 
    }
  }
  return new ImageData(out, width, height);
}

//main processing pipeline
async function run() {
  if (!files.length) return;

  const runBtn = document.getElementById("runBtn");
  runBtn.disabled = true;
  runBtn.textContent = "Processing…";

  const pw = document.getElementById("progressWrap");
  pw.style.display = "block";
  document.getElementById("logBox").innerHTML = "";
  document.getElementById("logBox").style.display = "block";

  // read settings from the ui
  const suffix = document.getElementById("suffix").value || "_edited";
  const outFmt = document.getElementById("outFmt").value;
  const mime = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" }[
    outFmt
  ];
  const angle = parseInt(document.getElementById("rotAngle").value);
  const doSharpen = document.getElementById("chkSharpen").checked;
  const doGray = document.getElementById("chkGray").checked;
  const doRotate = document.getElementById("chkRotate").checked;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(`processing <span class="info">${f.name}</span>`);
    document.getElementById("barFill").style.width =
      (i / files.length) * 100 + "%";
    document.getElementById("barLabel").textContent = `${i} / ${files.length}`;

    await new Promise((res) => {
      const img = new Image();

      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // draw original image onto a canvas
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        
        if (doSharpen) {
          const id = ctx.getImageData(0, 0, w, h);
          ctx.putImageData(sharpenPixels(id), 0, 0);
        }

        
        if (doGray) {
          const id = ctx.getImageData(0, 0, w, h);
          const d = id.data;
          for (let j = 0; j < d.length; j += 4) {
            const g = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
            d[j] = d[j + 1] = d[j + 2] = g;
          }
          ctx.putImageData(id, 0, 0);
        }

        if (doRotate) {
          const tmp = document.createElement("canvas");
          const isLateral = angle === 90 || angle === -90;
          tmp.width = isLateral ? h : w;
          tmp.height = isLateral ? w : h;
          const tc = tmp.getContext("2d");
          tc.translate(tmp.width / 2, tmp.height / 2);
          tc.rotate((angle * Math.PI) / 180);
          tc.drawImage(canvas, -w / 2, -h / 2);
          canvas.width = tmp.width;
          canvas.height = tmp.height;
          const newCtx = canvas.getContext("2d");
          newCtx.drawImage(tmp, 0, 0);
        }

        
        canvas.toBlob((blob) => {
          const base = f.name.replace(/\.[^.]+$/, "");
          const outName = `${base}${suffix}.${outFmt}`;

          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = outName;
          a.click();

        
          const card = document.getElementById("card-" + f.name);
          if (card) {
            card.classList.add("done");
            card.querySelector("img").src = URL.createObjectURL(blob);
            const st = card.querySelector(".status");
            st.textContent = "✓ saved";
            st.classList.add("ok");
          }

          log(
            `<span class="ok">✓ saved</span> ${outName} (${(blob.size / 1024).toFixed(1)} KB)`,
          );
          res(); 
        }, mime);
      };

      
      img.src = URL.createObjectURL(f);
    });
  }

  
  const fillBar = document.getElementById("barFill");
  fillBar.style.width = "100%";
  document.getElementById("barLabel").textContent =
    `${files.length} / ${files.length} — done`;
  log(
    `<span class="ok">✓ all done.</span> ${files.length} image(s) processed.`,
  );

  const finalRunBtn = document.getElementById("runBtn");
  finalRunBtn.disabled = false;
  finalRunBtn.textContent = "▶ Process Again";
}
