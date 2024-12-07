#include <vips/vips8>

#include "common.h"

using namespace std;
using namespace vips;

ArgumentMap Nerd(const string& type, string& outType, const char* bufferdata, size_t bufferLength, ArgumentMap arguments, size_t& dataSize)
{
  string basePath = GetArgument<string>(arguments, "basePath");

  VImage in =
      VImage::new_from_buffer(bufferdata, bufferLength, "",
                              GetInputOptions(type, true, false))
          .colourspace(VIPS_INTERPRETATION_sRGB);
  if (!in.has_alpha()) in = in.bandjoin(255);

  int width = in.width();
  int pageHeight = vips_image_get_page_height(in.get_image());
  int nPages = vips_image_get_n_pages(in.get_image());

  try {
    in = NormalizeVips(in, &width, &pageHeight, nPages);
  } catch (int e) {
    if (e == -1) {
      ArgumentMap output;
      output["buf"] = "";
      outType = "frames";
      return output;
    }
  }

  string assetPath = basePath + "assets/images/nerd.png";
  VImage bg = VImage::new_from_file(assetPath.c_str());

  vector<VImage> img;
  for (int i = 0; i < nPages; i++) {
    VImage img_frame =
        nPages > 1 ? in.crop(0, i * pageHeight, width, pageHeight) : in;
    VImage resized = img_frame.resize(
        345 / (double)width,
        VImage::option()->set("vscale", 430 / (double)pageHeight));
    
    VImage offset = resized.embed(502, 85, 1000, 1000);
    VImage composited = bg.composite2(offset, VIPS_BLEND_MODE_OVER);
    img.push_back(composited);
  }
  VImage final = VImage::arrayjoin(img, VImage::option()->set("across", 1));
  final.set(VIPS_META_PAGE_HEIGHT, 481);

  char *buf;
  final.write_to_buffer(
      ("." + outType).c_str(), reinterpret_cast<void**>(&buf), &dataSize,
      outType == "gif" ? VImage::option()->set("dither", 1) : 0);

  ArgumentMap output;
  output["buf"] = buf;

  return output;
}
