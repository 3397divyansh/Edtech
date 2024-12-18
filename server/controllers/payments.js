const {instance} =require("../config/razorpay")
const Course = require("../models/Course");
const crypto = require("crypto")
const User = require("../models/User")
const mailSender = require("../utils/mailSender")
const mongoose = require("mongoose")
const {
    courseEnrollmentEmail,
  } = require("../mail/templates/courseEnrollmentEmail")
  const {paymentSuccess} = require("../mail/templates/paymentSuccess");
  // const { default: mongoose } = require("mongoose");


  const CourseProgress = require("../models/CourseProgress")



  exports.capturePayment= async (req,res)=>{
     const { courses } = req.body
    const userId = req.user.id
    if (courses.length === 0) {
      return res.json({ success: false, message: "Please Provide Course ID" })
    }
  
    let total_amount = 0


    

        for( const course_id of courses){
            let course ;
            try{
                course = await Course.findById(course_id);
                if (!course) {
                    return res
                      .status(200)
                      .json({ success: false, message: "Could not find the Course" })
                  }

                  const uid=new mongoose.Mongoose.Types.ObjectId(userId);

                  if(course.studentsEnroled.includes(uid)){
                    return res
          .status(200)
          .json({ success: false, message: "Student is already Enrolled" })
                  }
                  total_amount+=course.price;




            }
            catch(error){
                
                console.log(error)
                return res.status(500).json({ success: false, message: error.message })
            }
        }


        const options = {
            ammount : total_amount*100,
            currency:"INR",
            receipt:Math.random(Date.now()).toString()
        }

        try{

            const paymentResponse = await instance.orders.create(options)

            console.log(paymentResponse);
            res.json({
                success: true,
                data: paymentResponse,
              })



    }
    catch(error){
        console.log(error)
        res
          .status(500)
          .json({ success: false, message: "Could not initiate order." })

    }
  }


  exports.verifyPayment=async(req,res)=>{

  }



  exports.verifySignature = async (req, res) => {
    //get the payment details
    const {razorpay_payment_id, razorpay_order_id, razorpay_signature} = req.body;
    const {courses} = req.body;
    const userId = req.user.id;


    if(!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
            success:false,
            message:'Payment details are incomplete',
        });
    }

    let body = razorpay_order_id + "|" + razorpay_payment_id;

    const enrolleStudent = async (courses, userId) => {
        if(!courses || !userId) {
            return res.status(400).json({
                success:false,
                message:'Please provide valid courses and user ID',
            });
        }
                try{
                    //update the course
                    for(const course_id of courses){
                    console.log("verify courses=",course_id);
                    const course = await Course.findByIdAndUpdate(
                        course_id,
                        {$push:{studentsEnrolled:userId}},
                        {new:true}
                    );
                    //update the user
                    const user = await User.updateOne(
                        {_id:userId},
                        {$push:{courses:course_id}},
                        {new:true}
                    );
                    //set course progress
                    const newCourseProgress = new CourseProgress({
                        userID: userId,
                        courseID: course_id,
                      })
                      await newCourseProgress.save()
                
                      //add new course progress to user
                      await User.findByIdAndUpdate(userId, {
                        $push: { courseProgress: newCourseProgress._id },
                      },{new:true});
                    //send email
                    const recipient = await User.findById(userId);
                    console.log("recipient=>",course);
                    const courseName = course.courseName;
                    const courseDescription = course.courseDescription;
                    const thumbnail = course.thumbnail;
                    const userEmail = recipient.email;
                    const userName = recipient.firstName + " " + recipient.lastName;
                    const emailTemplate = courseEnrollmentEmail(courseName,userName, courseDescription, thumbnail);
                    await mailSender(
                        userEmail,
                        `You have successfully enrolled for ${courseName}`,
                        emailTemplate,
                    );
                    }
                    return res.status(200).json({
                        success:true,
                        message:'Payment successful',
                    });
                }
                catch(error) {
                    console.error(error);
                    return res.status(500).json({
                        success:false,
                        message:error.message,
                    });
                }
            
        }

    try{
        //verify the signature
        const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET).update(body.toString()).digest("hex");
        if(generatedSignature === razorpay_signature) {
            await enrolleStudent(courses, userId);
        }

    }
    catch(error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message:error.message,
        });
    }

 
}









  exports.sendPaymentSuccessEmail=async(req,res)=>{
    const {orderId,paymentId,amount}=req.body;
    const userId = req.user.id
    
  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the details" })
  }

  try{
    const enrolledStudent = await User.findById(userId);

    await mailSender(enrolledStudent.email,`payment recieved`,paymentSuccess(

        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount/100,
        orderId,
        paymentId
    ))
  }
  catch (error) {
    console.log("error in sending mail", error)
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" })
  }
  }


  // exports.enrollstudents=asy(courss)