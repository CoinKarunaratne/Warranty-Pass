$(".addNew").click(function(){
  $(".newItem").css("display", "inline-block");
  $("#blur").addClass("blur");
})

$(".close,#submit").on("click", function(){
  $(".newItem").css("display", "none");
  $("#blur").removeClass("blur");
})

$(document).ready(function(){
  $("#submit").attr("disabled", true);
  $("#name,#date,#period").keyup(function (){
    $("#name,#date,#period").each(function(){
      if($(this).val().length !=0){
        $("#submit").attr("disabled", false);
      } else {
        $("#submit").attr("disabled", true);
      }
    })
  })
})
