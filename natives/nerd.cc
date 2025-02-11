#include <vips/vips8>

#include "common.h"

using namespace std;
using namespace vips;

ArgumentMap Nerd(const string& type, string& outType, const char* bufferdata, size_t bufferLength, ArgumentMap arguments, size_t& dataSize)
{
  string basePath = GetArgument<string>(arguments, "basePath");
  bool resize = GetArgumentWithFallback<bool>(arguments, "resize", false);

  VImage in =
      VImage::new_from_buffer(bufferdata, bufferLength, "",
                              GetInputOptions(type, true, false))
          .colourspace(VIPS_INTERPRETATION_sRGB);
  if (!in.has_alpha()) in = in.bandjoin(255);

  int width = in.width();
  int pageHeight = vips_image_get_page_height(in.get_image());
  int nPages = vips_image_get_n_pages(in.get_image());
  double aspectRatio = (double)width / pageHeight;

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

  if (resize) {
    aspectRatio = 0.8;
  }

  int inNewWidth;
  int inNewHeight;

  if (aspectRatio > 0.8) {
    if (aspectRatio > 1.512) {
      inNewWidth = 650;
      inNewHeight = 650 / aspectRatio;
    } else {
      inNewWidth = 430 * aspectRatio;
      inNewHeight = 430;
    }
  } else {
    if (aspectRatio > 0.575) {
      inNewWidth = 345;
      inNewHeight = 345 / aspectRatio;
    } else {
      inNewWidth = 600 * aspectRatio;
      inNewHeight = 600;
    }
  }
  
  int inTopLeftX = 675 - inNewWidth / 2;
  int inTopLeftY = 300 - inNewHeight / 2;

  vector<VImage> img;
  for (int i = 0; i < nPages; i++) {
    VImage img_frame =
        nPages > 1 ? in.crop(0, i * pageHeight, width, pageHeight) : in;
    VImage resized = img_frame.resize(
        inNewWidth / (double)width,
        VImage::option()->set("vscale", inNewHeight / (double)pageHeight));
    
    VImage offset = resized.embed(inTopLeftX, inTopLeftY, 1000, 1000);
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
