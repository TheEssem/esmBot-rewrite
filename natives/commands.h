#pragma once

// Vultu: These are both bad, but I wanted to clean up code at least a little
using std::string;
#define declare_input_func(NAME) ArgumentMap NAME(const string& type, string& outType, const char* bufferData, size_t bufferLength, ArgumentMap arguments, bool* shouldKill)
#define declare_noinput_func(NAME) ArgumentMap NAME(const string& type, string& outType, ArgumentMap arguments, bool* shouldKill)

// Declare our Input Functions
declare_input_func(Blur);
declare_input_func(Bounce);
declare_input_func(Caption);
declare_input_func(CaptionTwo);
declare_input_func(Circle);
declare_input_func(Colors);
declare_input_func(Crop);
declare_input_func(Deepfry);
declare_input_func(Distort);
declare_input_func(Flag);
declare_input_func(Flip);
declare_input_func(Freeze);
declare_input_func(Gamexplain);
declare_input_func(Globe);
declare_input_func(Invert);
declare_input_func(Jpeg);
#if MAGICK_ENABLED
declare_input_func(Magik);
#endif
declare_input_func(Meme);
declare_input_func(Mirror);
declare_input_func(Motivate);
declare_input_func(Nerd);
#if ZXING_ENABLED
declare_input_func(QrRead);
#endif
declare_input_func(Reddit);
declare_input_func(Resize);
declare_input_func(Reverse);
declare_input_func(Scott);
declare_input_func(Snapchat);
declare_input_func(Speed);
declare_input_func(Spin);
declare_input_func(Spotify);
declare_input_func(Squish);
declare_input_func(Swirl);
declare_input_func(Tile);
declare_input_func(ToGif);
declare_input_func(Uncanny);
declare_input_func(Uncaption);
#if MAGICK_ENABLED
declare_input_func(Wall);
#endif
declare_input_func(Watermark);
declare_input_func(Whisper);

// Declare our No-Input Functions

declare_noinput_func(Homebrew);
#if ZXING_ENABLED
declare_noinput_func(QrCreate);
#endif
declare_noinput_func(Sonic);
