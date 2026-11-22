#pragma once
// MinGW용 읽기 전용 mmap 호환 계층 (내 코드; 패키지 원본은 고치지 않는다).
// 구현은 shim/mman_win.cpp. windows.h의 매크로가 엔진 소스와 부딪히지 않게 선언만 둔다.
#include <cstddef>

#define PROT_READ 1
#define MAP_SHARED 1
#define MAP_FAILED ((void*)-1)

void* mmap(void* hint, size_t length, int prot, int flags, int fd, long long offset);
int munmap(void* address, size_t length);
