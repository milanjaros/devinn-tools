import type { Person } from './models';

const vcardText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export function contactVcard(person: Person): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardText(person.name)}`, `N:;${vcardText(person.name)};;;`, `ORG:${vcardText(person.employer)};${vcardText(person.department)}`, `TITLE:${vcardText(person.title)}`];
  if (person.email) lines.push(`EMAIL;TYPE=WORK:${vcardText(person.email)}`);
  if (person.phone) lines.push(`TEL;TYPE=WORK:${vcardText(person.phone)}`);
  const photo = person.photo?.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=${photo[1].toUpperCase()}:${photo[2].replace(/[\r\n]/g, '')}`);
  else if (person.photo && /^https?:\/\//i.test(person.photo)) lines.push(`PHOTO;VALUE=URI:${person.photo.replace(/[\r\n]/g, '')}`);
  lines.push('END:VCARD');
  // Fold by UTF-8 bytes, preserving multibyte characters and base64 data.
  const encoder = new TextEncoder();
  return lines.map(line => {
    let folded = '', bytes = 0;
    for (const character of line) {
      const size = character.charCodeAt(0) < 128 ? 1 : encoder.encode(character).length;
      if (bytes + size > 75) { folded += '\r\n '; bytes = 1; }
      folded += character; bytes += size;
    }
    return folded;
  }).join('\r\n') + '\r\n';
}
