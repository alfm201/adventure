// MinGW용 읽기 전용 mmap 구현 (CreateFileMapping). 패키지의 value.hpp, fixed_v1.hpp가 쓰는 범위만 지원한다.
#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#include <cstddef>

void* mmap(void*, size_t length, int, int, int fd, long long offset) {
  HANDLE file = (HANDLE)_get_osfhandle(fd);
  if (file == INVALID_HANDLE_VALUE) return (void*)-1;
  HANDLE mapping = CreateFileMappingA(file, nullptr, PAGE_READONLY, 0, 0, nullptr);
  if (!mapping) return (void*)-1;
  void* view = MapViewOfFile(mapping, FILE_MAP_READ, (DWORD)((unsigned long long)offset >> 32),
                             (DWORD)((unsigned long long)offset & 0xffffffffu), length);
  CloseHandle(mapping);
  return view ? view : (void*)-1;
}

int munmap(void* address, size_t) { return UnmapViewOfFile(address) ? 0 : -1; }
