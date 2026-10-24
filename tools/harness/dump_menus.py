"""Dump jhora.exe's MENU resources as text (id, nesting, caption) for the harness
and the UI's menu tables. Usage: python dump_menus.py <jhora.exe> <out.txt>"""
import struct, sys
import pefile

def parse_menu(data):
    out = []
    ver, hdr = struct.unpack_from('<HH', data, 0)
    pos = 4 + hdr
    if ver == 1:  # MENUEX
        pos = 4 + hdr
        depth = 0
        stack = []
        while pos < len(data):
            typ, state, mid, flags = struct.unpack_from('<IIIH', data, pos); pos += 14
            end = data.index(b'\0\0', pos)
            while (end - pos) % 2: end = data.index(b'\0\0', end + 1)
            text = data[pos:end].decode('utf-16le'); pos = end + 2
            pos = (pos + 3) & ~3
            out.append((len(stack), mid, text))
            if flags & 1:  # popup: has a help id dword
                pos += 4
                stack.append(flags & 0x80)
            elif flags & 0x80:
                while stack and stack.pop():
                    pass
        return out
    depth = 0
    ends = []
    while pos < len(data):
        flags, = struct.unpack_from('<H', data, pos); pos += 2
        mid = None
        if not flags & 0x10:
            mid, = struct.unpack_from('<H', data, pos); pos += 2
        end = pos
        while data[end:end + 2] != b'\0\0': end += 2
        text = data[pos:end].decode('utf-16le'); pos = end + 2
        out.append((depth, mid, text))
        if flags & 0x10:
            depth += 1; ends.append(bool(flags & 0x80))
        elif flags & 0x80:
            while ends:
                depth -= 1
                if not ends.pop():
                    break
    return out

pe = pefile.PE(sys.argv[1])
lines = []
for t in pe.DIRECTORY_ENTRY_RESOURCE.entries:
    if t.id != 4:  # RT_MENU
        continue
    for name in t.directory.entries:
        for lang in name.directory.entries:
            d = lang.data.struct
            raw = pe.get_memory_mapped_image()[d.OffsetToData:d.OffsetToData + d.Size]
            lines.append(f'MENU {name.id}')
            for depth, mid, text in parse_menu(raw):
                lines.append(f"{'  ' * (depth + 1)}{mid if mid is not None else '-'}\t{text}")
open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(lines))
print(len(lines), 'lines')
