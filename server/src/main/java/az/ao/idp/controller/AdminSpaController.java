package az.ao.idp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class AdminSpaController {

    @GetMapping({"/admin", "/admin/"})
    public String index() {
        return "forward:/admin/index.html";
    }

    @GetMapping("/admin/{path:[^\\.]*}")
    public String indexForPath() {
        return "forward:/admin/index.html";
    }
}

