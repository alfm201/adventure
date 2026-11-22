#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>
#include <stdexcept>

namespace vela_v5 {

struct Package {
  std::span<const std::byte> hinge;
  std::span<const std::byte> residual;
};

inline Package read_package(std::span<const std::byte> bytes) {
  constexpr std::size_t hinge_offset = 64, hinge_size = 91179876;
  constexpr std::size_t residual_offset = 91179968, residual_size = 461752;
  if (bytes.size() != residual_offset + residual_size)
    throw std::runtime_error("Invalid VELA v5 package size");

  // All fields in the section directory are little-endian.
  auto integer = [&](std::size_t offset, unsigned width) {
    std::uint64_t value = 0;
    for (unsigned i = 0; i < width; ++i)
      value |= std::uint64_t(std::to_integer<unsigned>(bytes[offset + i])) << (8 * i);
    return value;
  };

  if (std::memcmp(bytes.data(), "VELA5MDL", 8) || integer(8, 4) != 1 || integer(12, 4) != 2)
    throw std::runtime_error("Invalid VELA v5 package header");

  auto section = [&](std::size_t entry, const char(&name)[9], std::size_t offset,
                     std::size_t length) {
    if (std::memcmp(bytes.data() + entry, name, 8) || integer(entry + 8, 8) != offset ||
        integer(entry + 16, 8) != length)
      throw std::runtime_error("Invalid VELA v5 model section");
    return bytes.subspan(offset, length);
  };
  return {section(16, "HINGE\0\0\0", hinge_offset, hinge_size),
          section(40, "RESIDM2S", residual_offset, residual_size)};
}

} // namespace vela_v5
