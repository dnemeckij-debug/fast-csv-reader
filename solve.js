// Fast csv-reader 1.0.0 compatible implementation; no external dependencies.
export function run(input) {
  const text = String(input.text), n = text.length, header = input.header === true;
  const rows = [], errors = [];
  let columns = null, width = -1, pos = text.charCodeAt(0) === 65279 ? 1 : 0, line = 1;
  while (pos < n) {
    // Match reference: ignore empty LF/CRLF lines between records.
    let c;
    while (pos < n) {
      c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && text.charCodeAt(pos+1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;
    const recordLine = line, row = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = 1, lastQuoted = false;
    do {
      let value = '', wasQuoted = text.charCodeAt(pos) === 34;
      lastQuoted = wasQuoted;
      if (wasQuoted) {
        const opening = pos, openLine = line;
        pos++;
        const chunks = [];
        let closed = false;
        let segmentStart = pos;
        while (pos < n) {
          const i = text.indexOf('"', pos);
          const limit = i < 0 ? n : i;
          // Normalize CRLF and CR to LF while counting line terminators.
          let chunk = text.slice(segmentStart, limit);
          if (chunk.indexOf('\r') >= 0) chunk = chunk.replace(/\r\n?/g, '\n');
          if (chunk.indexOf('\n') >= 0) {
            for (let j=0; j<chunk.length;j++) if (chunk.charCodeAt(j) === 10) line++;
          }
          chunks.push(chunk);
          if (i < 0) { pos = n; break; }
          if (text.charCodeAt(i+1) === 34) {
            chunks.push('"'); pos = i+2; segmentStart = pos;
          } else { pos = i+1; closed = true; break; }
        }
        if (!closed) {
          pos = opening + 1; line = openLine;
          errors.push({code:'unterminated_quote',line:recordLine,row});
          value = '"';
        } else {
          value = chunks.join('');
          if (pos === n) { fields.push(value); ended = 0; continue; }
          c = text.charCodeAt(pos);
          if (c === 44) {pos++; fields.push(value); ended = 1; continue;}
          if (c === 10) {pos++;line++;fields.push(value);ended=0;continue;}
          if (c === 13 && text.charCodeAt(pos+1) === 10) {pos+=2;line++;fields.push(value);ended=0;continue;}
          // junk gets appended until comma/record boundary; report quote_junk only if kept chars exist.
          let added = 0;
          let bufStart = pos;
          const parts = [value];
          while (pos < n) {
            c = text.charCodeAt(pos);
            if (c === 44 || c === 10 || c === 13) {
              if (c === 13 && text.charCodeAt(pos+1) !== 10) {
                if (pos > bufStart) {parts.push(text.slice(bufStart,pos));added+=pos-bufStart;}
                errors.push({code:'stray_cr',line:recordLine,row});pos++;bufStart=pos;continue;
              }
              break;
            }
            pos++;
          }
          if (pos>bufStart){parts.push(text.slice(bufStart,pos));added+=pos-bufStart;}
          if (added) errors.push({code:'quote_junk',line:recordLine,row});
          value=parts.join('');
          c=text.charCodeAt(pos);
          if(c===44){pos++;ended=1;}else if(c===10){pos++;line++;ended=0;}else if(c===13 && text.charCodeAt(pos+1)===10){pos+=2;line++;ended=0;}else ended=0;
          fields.push(value);continue;
        }
      }
      // Unquoted, including unterminated-quote fallback.
      const pieces = [value];
      let start = pos;
      while (pos < n) {
        c = text.charCodeAt(pos);
        if (c === 44 || c === 10 || c === 13) {
          if (c === 13 && text.charCodeAt(pos+1) !== 10) {
            if(pos>start) pieces.push(text.slice(start,pos));
            errors.push({code:'stray_cr',line:recordLine,row});pos++;start=pos;continue;
          }
          break;
        }
        pos++;
      }
      if(pos>start) pieces.push(text.slice(start,pos));
      value=pieces.join('');
      c=text.charCodeAt(pos);
      if(c===44){pos++;ended=1;}else if(c===10){pos++;line++;ended=0;}else if(c===13 && text.charCodeAt(pos+1)===10){pos+=2;line++;ended=0;}else ended=0;
      fields.push(value);
    } while (ended === 1);
    if(fields.length === 1 && fields[0] === '' && !lastQuoted) continue;
    if(width < 0) width=fields.length;
    if(header && columns === null){columns=fields;continue;}
    if(fields.length < width){errors.push({code:'short_row',line:recordLine,row,fields:fields.length});while(fields.length<width)fields.push('');}
    else if(fields.length>width){errors.push({code:'long_row',line:recordLine,row,extra:fields.splice(width)});}
    rows.push(fields);
  }
  return {columns:header ? (columns ?? []) : null,rows,errors};
}
