const cloudinary=require('cloudinary').v2
exports.uploadImageToCloudinary=async function (file,folder,height,quality){
    console.log(folder);
    console.log(file.tempFilePath);
    const options={folder};
    if(height){
        options.height=height;
    }
    if(quality){
        options.quality=quality;
    }
    return await cloudinary.uploader.upload(file.tempFilePath,options)
} 